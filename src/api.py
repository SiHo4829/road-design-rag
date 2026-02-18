from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sys
from urllib.parse import quote

sys.path.append(os.path.dirname(__file__))

from contextlib import asynccontextmanager
from qa_engine import QAEngine
from logger import Logger
from pdf_monitor import PDFMonitor, PDFWatcher
from vector_store import VectorStore
from pdf_processor import PDFProcessor

qa_engine = None
pdf_watcher = None

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

@asynccontextmanager
async def lifespan(app):
    global qa_engine, pdf_watcher

    print("QA 엔진 초기화 중...")
    qa_engine = QAEngine()
    print("✓ QA 엔진 초기화 완료!")

    pdf_watcher = PDFWatcher(data_folder="data", on_update=_handle_new_pdfs)
    pdf_watcher.start()

    yield

    pdf_watcher.stop()

app = FastAPI(
    title="도로설계 기준 AI API",
    description="도로설계 기준 문서 기반 질의응답 API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str
    session_id: str

class ChatResponse(BaseModel):
    answer: str
    sources: list
    session_id: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        logger = Logger(session_id=request.session_id)
        response = qa_engine.ask(
            question=request.question,
            logger=logger
        )
        return ChatResponse(
            answer=response['answer'],
            sources=response['sources'],
            session_id=request.session_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pdf/{filename}")
async def get_pdf(filename: str):
    pdf_path = os.path.join("data", filename)

    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=404,
            detail=f"파일을 찾을 수 없습니다: {filename}"
        )

    encoded_filename = quote(filename)

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}"
        }
    )

@app.get("/api/documents")
async def get_documents():
    data_folder = "data"
    if not os.path.exists(data_folder):
        return {"documents": []}

    pdf_files = [
        f for f in os.listdir(data_folder)
        if f.lower().endswith('.pdf')
    ]
    return {"documents": pdf_files}

@app.get("/api/logs/{session_id}")
async def get_logs(session_id: str, date: str = None):
    try:
        logger = Logger(session_id=session_id)
        if date:
            logs = logger.get_logs(date)
        else:
            logs = logger.get_logs()
        return {
            "session_id": session_id,
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/{session_id}/dates")
async def get_log_dates(session_id: str):
    try:
        logger = Logger(session_id=session_id)
        dates = logger.get_all_log_dates()
        return {
            "session_id": session_id,
            "dates": dates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/update")
async def update_documents():
    try:
        monitor = PDFMonitor()
        changes = monitor.check_changes()

        if not changes['has_changes']:
            return {"message": "업데이트할 문서가 없습니다."}

        vector_store = VectorStore()
        vector_store.load_vectorstore()

        new_chunks = []
        processed_files = []

        for filename in changes['added'] + changes['modified']:
            filepath = os.path.join("data", filename)
            processor = PDFProcessor(filepath)
            chunks = vector_store.create_chunks_from_pdf(processor)
            new_chunks.extend(chunks)
            processed_files.append(filename)

        if new_chunks:
            vector_store.update_vectorstore(new_chunks)

        monitor.update_state()

        return {
            "message": "업데이트 완료",
            "processed_files": processed_files,
            "added_chunks": len(new_chunks)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 프론트엔드 정적 파일 서빙 (빌드된 React 앱)
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA fallback: 모든 비-API 경로를 index.html로"""
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        return HTMLResponse(open(index_path, encoding="utf-8").read())
