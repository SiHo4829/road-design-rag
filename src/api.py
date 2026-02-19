from fastapi import FastAPI, HTTPException, Header, UploadFile, File, BackgroundTasks, Request
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from apscheduler.schedulers.background import BackgroundScheduler
import asyncio
import os
import sys
import json
import time
import hashlib
import tarfile
import glob
from urllib.parse import quote
from datetime import datetime

sys.path.append(os.path.dirname(__file__))

from contextlib import asynccontextmanager
from qa_engine import QAEngine
from logger import Logger
from pdf_monitor import PDFMonitor, PDFWatcher
from vector_store import VectorStore
from pdf_processor import PDFProcessor, load_all_pdfs_from_folder

# ─── 전역 상태 ───────────────────────────────────────────────

qa_engine = None
pdf_watcher = None
scheduler = None
rebuild_status = {"running": False, "message": "대기 중"}

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "roadspec2024")

# 응답 캐시 {hash: {answer, sources, time}}
_cache = {}
_cache_hits = 0
CACHE_TTL = 3600  # 1시간

# ─── 헬퍼 함수 ───────────────────────────────────────────────

def _check_admin(password: str):
    if not password or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="비밀번호가 틀렸습니다.")

def _cache_key(question: str) -> str:
    return hashlib.md5(question.strip().lower().encode()).hexdigest()

def _get_cached(question: str):
    key = _cache_key(question)
    if key in _cache:
        entry = _cache[key]
        if time.time() - entry["time"] < CACHE_TTL:
            return entry
        del _cache[key]
    return None

def _set_cache(question: str, answer: str, sources: list):
    _cache[_cache_key(question)] = {"answer": answer, "sources": sources, "time": time.time()}

def _backup_vectordb():
    """vectordb 압축 백업 (최근 5개 유지)"""
    if not os.path.exists("vectordb"):
        return
    os.makedirs("backups", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join("backups", f"vectordb_{timestamp}.tar.gz")
    with tarfile.open(backup_path, "w:gz") as tar:
        tar.add("vectordb", arcname="vectordb")
    # 최근 5개만 유지
    backups = sorted(glob.glob(os.path.join("backups", "vectordb_*.tar.gz")))
    for old in backups[:-5]:
        os.remove(old)
    print(f"✓ vectordb 백업 완료: {backup_path}")

def _handle_new_pdfs(filenames):
    """PDF 추가/변경 시 벡터 DB 업데이트 + BM25 재구축"""
    vector_store = qa_engine.vector_store
    monitor = PDFMonitor()

    new_chunks = []
    for filename in filenames:
        filepath = os.path.join("data", filename)
        if not os.path.exists(filepath):
            continue
        processor = PDFProcessor(filepath)
        chunks = vector_store.create_chunks_from_pdf(processor)
        new_chunks.extend(chunks)
        print(f"  ✓ {filename}: {len(chunks)}개 청크 생성")

    if new_chunks:
        vector_store.update_vectorstore(new_chunks)
        qa_engine._build_bm25_index()
        print(f"✓ 벡터 DB + BM25 인덱스 업데이트 완료! ({len(new_chunks)}개 청크 추가)")

    monitor.update_state()

# ─── 앱 초기화 ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app):
    global qa_engine, pdf_watcher, scheduler

    print("QA 엔진 초기화 중...")
    qa_engine = QAEngine()
    print("✓ QA 엔진 초기화 완료!")

    pdf_watcher = PDFWatcher(data_folder="data", on_update=_handle_new_pdfs)
    pdf_watcher.start()

    # 스케줄러: 매일 새벽 3시 백업 + 로그 정리
    scheduler = BackgroundScheduler()
    scheduler.add_job(_backup_vectordb, 'cron', hour=3, minute=0)
    scheduler.add_job(lambda: Logger.cleanup_old_logs(days=30), 'cron', hour=3, minute=30)
    scheduler.start()
    print("✓ 스케줄러 시작 (매일 03:00 백업, 03:30 로그 정리)")

    yield

    pdf_watcher.stop()
    scheduler.shutdown()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Roadspec API",
    description="도로설계 기준 문서 기반 질의응답 API",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 모델 ────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    session_id: str
    history: list = []  # [{"role": "user"/"assistant", "content": "..."}]
    selected_sources: list = []  # 빈 배열 = 전체 검색

    @field_validator('question')
    @classmethod
    def check_length(cls, v):
        v = v.strip()
        if len(v) == 0:
            raise ValueError('질문을 입력해주세요.')
        if len(v) > 500:
            raise ValueError('질문은 500자 이내로 입력해주세요.')
        return v

class ChatResponse(BaseModel):
    answer: str
    sources: list
    session_id: str

class FeedbackRequest(BaseModel):
    session_id: str
    question: str
    rating: int  # 1 = 좋아요, -1 = 싫어요

# ─── 채팅 엔드포인트 ─────────────────────────────────────────

@app.post("/api/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(request: Request, body: ChatRequest):
    # 캐시 확인 (히스토리 없을 때만, 문서 필터 없을 때만)
    if not body.history and not body.selected_sources:
        cached = _get_cached(body.question)
        if cached:
            global _cache_hits
            _cache_hits += 1
            async def cached_gen():
                yield f"data: {json.dumps({'type': 'cache_hit'})}\n\n"
                for token in cached["answer"]:
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                yield f"data: {json.dumps({'type': 'sources', 'sources': cached['sources']})}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(
                cached_gen(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
            )

    # 검색은 스레드풀에서 실행 (BM25 CPU 블로킹 방지)
    loop = asyncio.get_event_loop()
    filter_sources = body.selected_sources or None
    stream, sources = await loop.run_in_executor(
        None, lambda: qa_engine.ask_stream(
            body.question,
            history=body.history,
            filter_sources=filter_sources
        )
    )

    async def generate():
        full_answer = ""
        try:
            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    full_answer += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            if not body.history and not body.selected_sources:
                _set_cache(body.question, full_answer, sources)

            logger = Logger(session_id=body.session_id)
            logger.log(question=body.question, answer=full_answer, sources=sources)

            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

            # 연관 질문 추천 (히스토리·필터 없을 때만)
            if not body.history and not body.selected_sources:
                related = qa_engine.get_related_questions(body.question)
                if related:
                    yield f"data: {json.dumps({'type': 'related_questions', 'questions': related})}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

# ─── 피드백 엔드포인트 ───────────────────────────────────────

@app.post("/api/feedback")
async def submit_feedback(body: FeedbackRequest):
    logger = Logger(session_id=body.session_id)
    logger.log_feedback(body.question, body.rating)
    return {"message": "피드백 감사합니다"}

@app.get("/api/admin/feedback")
async def admin_feedback_stats(x_admin_password: str = Header(None)):
    _check_admin(x_admin_password)
    feedback_data = []
    log_dir = "logs"
    if os.path.exists(log_dir):
        for session in os.listdir(log_dir):
            session_dir = os.path.join(log_dir, session)
            if not os.path.isdir(session_dir):
                continue
            for filename in os.listdir(session_dir):
                if not (filename.startswith("feedback_") and filename.endswith(".json")):
                    continue
                try:
                    with open(os.path.join(session_dir, filename), 'r', encoding='utf-8') as f:
                        feedbacks = json.load(f)
                    feedback_data.extend(feedbacks)
                except Exception:
                    pass
    stats = {
        "total": len(feedback_data),
        "positive": sum(1 for f in feedback_data if f.get("rating") == 1),
        "negative": sum(1 for f in feedback_data if f.get("rating") == -1),
    }
    recent = sorted(feedback_data, key=lambda x: x.get("timestamp", ""), reverse=True)[:50]
    return {"feedbacks": recent, "stats": stats}

# ─── 관리자 엔드포인트 ───────────────────────────────────────

@app.get("/api/admin/stats")
async def admin_stats(x_admin_password: str = Header(None)):
    _check_admin(x_admin_password)
    stats = Logger.get_global_stats()
    stats["cache_size"] = len(_cache)
    stats["cache_hits"] = _cache_hits
    return stats

@app.post("/api/admin/upload")
async def admin_upload(
    file: UploadFile = File(...),
    x_admin_password: str = Header(None)
):
    _check_admin(x_admin_password)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")
    os.makedirs("data", exist_ok=True)
    dest = os.path.join("data", file.filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return {"message": f"{file.filename} 업로드 완료"}

@app.post("/api/admin/rebuild")
async def admin_rebuild(
    background_tasks: BackgroundTasks,
    x_admin_password: str = Header(None)
):
    _check_admin(x_admin_password)
    if rebuild_status["running"]:
        raise HTTPException(status_code=409, detail="이미 재구축 중입니다.")

    def _rebuild():
        global rebuild_status
        rebuild_status = {"running": True, "message": "PDF 로딩 중..."}
        try:
            processors = load_all_pdfs_from_folder("data")
            rebuild_status["message"] = f"{len(processors)}개 PDF 청킹 중..."
            all_chunks = []
            for p in processors:
                all_chunks.extend(qa_engine.vector_store.create_chunks_from_pdf(p))
            rebuild_status["message"] = f"{len(all_chunks)}개 청크 임베딩 중..."
            qa_engine.vector_store.create_vectorstore(all_chunks)
            qa_engine._build_bm25_index()
            _cache.clear()  # 캐시 초기화
            rebuild_status = {"running": False, "message": f"완료 ({len(all_chunks)}개 청크)"}
        except Exception as e:
            rebuild_status = {"running": False, "message": f"오류: {str(e)}"}

    background_tasks.add_task(_rebuild)
    return {"message": "DB 재구축 시작"}

@app.get("/api/admin/rebuild/status")
async def admin_rebuild_status(x_admin_password: str = Header(None)):
    _check_admin(x_admin_password)
    return rebuild_status

@app.post("/api/admin/backup")
async def admin_backup(x_admin_password: str = Header(None)):
    _check_admin(x_admin_password)
    _backup_vectordb()
    return {"message": "백업 완료"}

@app.post("/api/admin/cache/clear")
async def admin_cache_clear(x_admin_password: str = Header(None)):
    _check_admin(x_admin_password)
    count = len(_cache)
    _cache.clear()
    return {"message": f"캐시 {count}개 삭제 완료"}

@app.get("/api/admin/logs")
async def admin_logs(x_admin_password: str = Header(None)):
    _check_admin(x_admin_password)
    log_dir = "logs"
    if not os.path.exists(log_dir):
        return {"sessions": []}
    sessions = [d for d in os.listdir(log_dir) if os.path.isdir(os.path.join(log_dir, d))]
    result = []
    for session in sessions:
        logger = Logger(session_id=session)
        dates = logger.get_all_log_dates()
        result.append({"session_id": session, "dates": dates})
    return {"sessions": result}

# ─── 일반 엔드포인트 ─────────────────────────────────────────

@app.get("/api/pdf/{filename}")
async def get_pdf(filename: str):
    pdf_path = os.path.join("data", filename)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {filename}")
    encoded_filename = quote(filename)
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}"}
    )

@app.get("/api/documents")
async def get_documents():
    data_folder = "data"
    if not os.path.exists(data_folder):
        return {"documents": []}
    pdf_files = [f for f in os.listdir(data_folder) if f.lower().endswith('.pdf')]
    return {"documents": pdf_files}

@app.delete("/api/admin/documents/{filename}")
async def admin_delete_document(filename: str, x_admin_password: str = Header(None)):
    _check_admin(x_admin_password)
    pdf_path = os.path.join("data", filename)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    os.remove(pdf_path)
    qa_engine.vector_store.delete_by_source(filename)
    qa_engine._build_bm25_index()
    _cache.clear()
    return {"message": f"{filename} 삭제 완료"}

@app.get("/api/logs/{session_id}")
async def get_logs(session_id: str, date: str = None):
    try:
        logger = Logger(session_id=session_id)
        logs = logger.get_logs(date) if date else logger.get_logs()
        return {"session_id": session_id, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/{session_id}/dates")
async def get_log_dates(session_id: str):
    try:
        logger = Logger(session_id=session_id)
        dates = logger.get_all_log_dates()
        return {"session_id": session_id, "dates": dates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health():
    return {"status": "ok"}

# ─── 프론트엔드 서빙 ─────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        return HTMLResponse(open(index_path, encoding="utf-8").read())
