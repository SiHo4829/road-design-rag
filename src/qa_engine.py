from groq import Groq
from vector_store import VectorStore
from logger import Logger
from rank_bm25 import BM25Okapi
import os
from dotenv import load_dotenv

load_dotenv()

class QAEngine:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        self.vector_store = VectorStore()
        self.vector_store.load_vectorstore()
        
        # BM25 인덱스 구축
        print("BM25 인덱스 구축 중...")
        self._build_bm25_index()
        print("✓ BM25 인덱스 구축 완료!")
        
        self.prompt_template = """아래 [참고 문서]를 읽고 [질문]에 답하세요.

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

    def _build_bm25_index(self):
        """BM25 인덱스 구축"""
        collection = self.vector_store.vectorstore.get()
        self.all_docs = collection['documents']
        self.all_metadatas = collection['metadatas']
        tokenized = [doc.split() for doc in self.all_docs]
        self.bm25 = BM25Okapi(tokenized)

    def extract_keywords(self, question):
        """질문에서 핵심 키워드 추출"""
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "user",
                    "content": f"""다음 질문에서 검색에 필요한 핵심 키워드만 추출하세요.
키워드는 공백으로 구분하고 3개 이내로만 답하세요.
다른 말은 하지 마세요.

질문: {question}
키워드:"""
                }
            ],
            temperature=0,
            max_tokens=20,
        )
        keywords = response.choices[0].message.content.strip()
        print(f"추출된 키워드: {keywords}")
        return keywords

    def hybrid_search(self, question, k=10):
        """벡터 검색 + BM25 검색 결합"""
        
        # 1. 키워드 추출
        keywords = self.extract_keywords(question)
        
        # 2. 벡터 검색 (원래 질문으로)
        vector_results = self.vector_store.search(question, k=k)
        
        # 벡터 결과 딕셔너리화
        combined = {}
        for doc, score in vector_results:
            combined[doc.page_content] = {
                'doc': doc,
                'score': score * 0.6,  # 벡터 가중치 0.6
                'metadata': doc.metadata
            }
        
        # 3. BM25 검색 (추출된 키워드로)
        tokenized_query = keywords.split()
        bm25_scores = self.bm25.get_scores(tokenized_query)
        
        top_bm25_idx = sorted(
            range(len(bm25_scores)),
            key=lambda i: bm25_scores[i],
            reverse=True
        )[:k]
        
        max_bm25 = max(bm25_scores[i] for i in top_bm25_idx) if top_bm25_idx else 1
        
        # 4. BM25 결과 합치기 (가중치 0.4)
        for idx in top_bm25_idx:
            content = self.all_docs[idx]
            bm25_score = bm25_scores[idx] / max_bm25 if max_bm25 > 0 else 0
            
            if content in combined:
                combined[content]['score'] += bm25_score * 0.4
            else:
                combined[content] = {
                    'doc': None,
                    'score': bm25_score * 0.4,
                    'metadata': self.all_metadatas[idx],
                    'content': content
                }
        
        # 5. 점수 순 정렬
        sorted_results = sorted(
            combined.values(),
            key=lambda x: x['score'],
            reverse=True
        )[:k]
        
        return sorted_results

    def ask(self, question, logger=None):
        # 1. 하이브리드 검색
        results = self.hybrid_search(question, k=10)
        
        # 2. 상위 5개 컨텍스트 구성
        context = ""
        sources = []
        
        for item in results[:5]:
            if item['doc']:
                content = item['doc'].page_content
                metadata = item['doc'].metadata
            else:
                content = item.get('content', '')
                metadata = item.get('metadata', {})
            
            context += f"\n{content}\n"
            sources.append({
                'filename': metadata.get('source', ''),
                'page': metadata.get('page', ''),
                'content': content[:200]
            })
        
        # 3. 프롬프트 생성
        prompt = self.prompt_template.format(
            context=context,
            question=question
        )
        
        # 4. 답변 생성
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,
            max_tokens=2048,
        )
        answer = response.choices[0].message.content
        
        # 5. 로그 기록
        if logger:
            logger.log(
                question=question,
                answer=answer,
                sources=sources
            )
        
        return {
            'question': question,
            'answer': answer,
            'sources': sources
        }


# 테스트 코드
if __name__ == "__main__":
    engine = QAEngine()
    
    test_questions = [
        "도로의 설계속도는 어떻게 결정하나요?",
        "차로의 최소 폭은 얼마인가요?",
        "주간선도로의 도로 폭원은?",
    ]
    
    for question in test_questions:
        print(f"\n질문: {question}")
        print("-" * 40)
        response = engine.ask(question)
        print(f"답변: {response['answer']}")
        print(f"\n출처:")
        for i, source in enumerate(response['sources'], 1):
            print(f"  [{i}] {source['filename']} - 페이지 {source['page']}")