from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from vector_store import VectorStore
from logger import Logger

class QAEngine:
    """질의응답 엔진 클래스"""
    
    def __init__(self, model_name="llama3.2:3b"):
        """
        Args:
            model_name: Ollama 모델명
        """
        self.model_name = model_name
        
        # LLM 초기화
        self.llm = Ollama(
            model=model_name,
            temperature=0.1,  # 낮을수록 일관된 답변
        )
        
        # 벡터스토어 로드
        self.vector_store = VectorStore()
        self.vector_store.load_vectorstore()
        
        # 프롬프트 템플릿 설정
        self.prompt_template = PromptTemplate(
                input_variables=["context", "question"],
                template="""아래 [참고 문서]를 읽고 [질문]에 답하세요.

            규칙:
            1. 반드시 한국어로 답변
            2. [참고 문서] 내용만 사용
            3. 문서에 답이 있으면 반드시 답변
            4. 표 데이터도 참고하여 답변
            5. 없으면 "문서에서 찾을 수 없습니다" 라고만 답변
            
            [참고 문서]
            {context}

            [질문]
            {question}

                [답변]"""
        )
        
        # QA 체인 설정
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=self.vector_store.vectorstore.as_retriever(
                search_kwargs={"k": 5}  # 상위 3개 청크 참조
            ),
            chain_type_kwargs={"prompt": self.prompt_template},
            return_source_documents=True  # 출처 반환
        )
    
    # ask() 함수에서 logger 받도록 수정
    def ask(self, question, logger=None):
        result = self.qa_chain({"query": question})
    
        sources = []
        for doc in result['source_documents']:
            source = {
                'filename': doc.metadata.get('source', '알 수 없음'),
                'page': doc.metadata.get('page', 0),
                'content': doc.page_content[:200]
            }   
            if source not in sources:
                sources.append(source)
    
        response = {
            'question': question,
            'answer': result['result'],
            'sources': sources
        }
    
        # 로그 저장 (logger 있을 때만)
        if logger:
            logger.log(
                question=question,
                answer=result['result'],
                sources=sources
            )
    
        return response
    
    def format_response(self, response):
        """
        답변을 보기 좋게 포맷팅
        
        Args:
            response: ask() 반환값
        """
        print("\n" + "=" * 60)
        print(f"질문: {response['question']}")
        print("=" * 60)
        print(f"\n답변:\n{response['answer']}")
        print("\n" + "-" * 60)
        print("출처:")
        for i, source in enumerate(response['sources'], 1):
            print(f"\n[{i}] {source['filename']}")
            print(f"    페이지: {source['page']}")
            print(f"    내용 미리보기: {source['content']}...")
        print("=" * 60)


# 테스트 코드
if __name__ == "__main__":
    print("QA 엔진 초기화 중...")
    engine = QAEngine()
    
    # 테스트 질문
    test_questions = [
        "도로의 설계속도는 어떻게 결정하나요?",
        "차로의 최소 폭은 얼마인가요?",
    ]
    
    for question in test_questions:
        response = engine.ask(question)
        engine.format_response(response)