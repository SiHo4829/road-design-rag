import streamlit as st
import sys
import os
import uuid

# src 폴더 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from qa_engine import QAEngine
from pdf_processor import load_all_pdfs_from_folder
from vector_store import VectorStore
from logger import Logger
from pdf_monitor import PDFMonitor

# 세션 상태 초기화
if 'session_id' not in st.session_state:
    # 접속 시 자동으로 고유 세션 ID 생성
    st.session_state.session_id = str(uuid.uuid4())[:8]

if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []

# 페이지 설정
st.set_page_config(
    page_title="도로설계 기준 AI 챗봇",
    page_icon="🛣️",
    layout="wide"
)

# QA 엔진 초기화 (한 번만 실행)
@st.cache_resource
def init_engine():
    return QAEngine()

@st.cache_resource
def init_monitor():
    return PDFMonitor()

# 세션별 Logger 초기화
def init_logger(session_id):
    return Logger(session_id=session_id)

# 세션 상태 초기화
if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []

# ==================== UI 레이아웃 ====================

# 사이드바: 문서 목록
with st.sidebar:
    st.title("📚 참조 문서")
    st.divider()
    
    # PDF 목록 표시
    data_folder = "data"
    if os.path.exists(data_folder):
        pdf_files = [f for f in os.listdir(data_folder) 
                    if f.lower().endswith('.pdf')]
        
        if pdf_files:
            for pdf in pdf_files:
                st.markdown(f"📄 {pdf}")
        else:
            st.warning("PDF 파일이 없습니다.")
    
    st.divider()
    
    # PDF 변경 감지 섹션 추가
    st.subheader("🔄 문서 업데이트")
    monitor = init_monitor()
    changes = monitor.check_changes()
    
    if changes['has_changes']:
        # 변경사항 표시
        if changes['added']:
            for f in changes['added']:
                st.success(f"➕ 새 문서: {f}")
        if changes['removed']:
            for f in changes['removed']:
                st.error(f"➖ 삭제된 문서: {f}")
        if changes['modified']:
            for f in changes['modified']:
                st.warning(f"✏️ 수정된 문서: {f}")
        
        # 업데이트 버튼
        if st.button("🔄 DB 업데이트", type="primary"):
            with st.spinner("DB 업데이트 중..."):
                try:
                    # 변경된 PDF 처리
                    vector_store = VectorStore()
                    vector_store.load_vectorstore()
                    
                    # 추가/수정된 PDF 처리
                    new_chunks = []
                    for filename in changes['added'] + changes['modified']:
                        filepath = os.path.join("data", filename)
                        from pdf_processor import PDFProcessor
                        processor = PDFProcessor(filepath)
                        chunks = vector_store.create_chunks_from_pdf(processor)
                        new_chunks.extend(chunks)
                        st.info(f"📄 {filename}: {len(chunks)}개 청크 처리")
                    
                    # DB 업데이트
                    if new_chunks:
                        vector_store.update_vectorstore(new_chunks)
                    
                    # 상태 저장
                    monitor.update_state()
                    st.cache_resource.clear()
                    st.success("✅ DB 업데이트 완료!")
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"오류 발생: {str(e)}")
    else:
        st.info("✅ 모든 문서가 최신 상태입니다.")
    
    st.divider()
    
    # 로그 조회
    st.subheader("📋 내 대화 로그")
    st.caption(f"세션 ID: {st.session_state.session_id}")

    logger = init_logger(st.session_state.session_id)
    log_dates = logger.get_all_log_dates()

    if log_dates:
        selected_date = st.selectbox(
            "날짜 선택",
            log_dates
        )
    
        # selected_date가 있을 때만 버튼 표시
        if selected_date and st.button("로그 보기"):
            logs = logger.get_logs(selected_date)
            st.info(f"총 {len(logs)}개의 대화")
            for log in logs:
                with st.expander(f"🕐 {log['timestamp']}"):
                    st.markdown(f"**질문:** {log['question']}")
                    st.markdown(f"**답변:** {log['answer']}")
    else:
        st.info("저장된 로그가 없습니다.")

# 메인 화면
st.title("🛣️ 도로설계 기준 AI 챗봇")
st.caption("도로설계 기준 문서를 기반으로 질문에 답변합니다.")
st.divider()

# 채팅 히스토리 표시
for chat in st.session_state.chat_history:
    # 질문
    with st.chat_message("user"):
        st.write(chat['question'])
    
    # 답변
    with st.chat_message("assistant"):
        st.write(chat['answer'])
        
        # 출처 표시
        with st.expander("📎 출처 보기"):
            for i, source in enumerate(chat['sources'], 1):
                st.markdown(f"**[{i}] {source['filename']}**")
                st.markdown(f"- 페이지: {source['page']}")
                st.markdown(f"- 내용 미리보기: {source['content']}")
                st.divider()

# 질문 입력
question = st.chat_input("도로설계 기준에 대해 질문하세요...")

if question:
    with st.chat_message("user"):
        st.write(question)
    
    with st.chat_message("assistant"):
        with st.spinner("답변 생성 중..."):
            try:
                engine = init_engine()
                logger = init_logger(st.session_state.session_id)
                
                # logger 전달
                response = engine.ask(question, logger=logger)
                
                st.write(response['answer'])
                
                with st.expander("📎 출처 보기"):
                    for i, source in enumerate(response['sources'], 1):
                        st.markdown(f"**[{i}] {source['filename']}**")
                        st.markdown(f"- 페이지: {source['page']}")
                        st.markdown(f"- 내용 미리보기: {source['content']}")
                        st.divider()
                
                st.session_state.chat_history.append(response)
                
            except Exception as e:
                st.error(f"오류 발생: {str(e)}")