from groq import Groq
from vector_store import VectorStore
from logger import Logger
from rank_bm25 import BM25Okapi
from kiwipiepy import Kiwi
import os
from dotenv import load_dotenv

load_dotenv()

class QAEngine:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

        self.vector_store = VectorStore()
        self.vector_store.load_vectorstore()

        # 한국어 형태소 분석기 (로컬, API 호출 불필요)
        self.kiwi = Kiwi()

        # BM25 인덱스 구축 (형태소 기반)
        print("BM25 인덱스 구축 중...")
        self._build_bm25_index()
        print("✓ BM25 인덱스 구축 완료!")

        self.prompt_template = """[참고 문서]를 기반으로 [질문]에 한국어로 답하세요.
문서에 답이 없으면 "문서에서 찾을 수 없습니다"라고만 답하세요.

[참고 문서]
{context}

[질문]
{question}"""

    def _tokenize(self, text):
        """한국어 형태소 분석 기반 토크나이징 (명사/동사/형용사만 추출)"""
        tokens = []
        for token in self.kiwi.tokenize(text):
            # NNG(일반명사), NNP(고유명사), VV(동사), VA(형용사), SL(외국어)
            if token.tag in ('NNG', 'NNP', 'VV', 'VA', 'SL') and len(token.form) > 1:
                tokens.append(token.form)
        return tokens

    def _build_bm25_index(self):
        """BM25 인덱스 구축 (형태소 분석 기반)"""
        collection = self.vector_store.vectorstore.get()
        self.all_docs = collection['documents']
        self.all_metadatas = collection['metadatas']
        tokenized = [self._tokenize(doc) for doc in self.all_docs]
        self.bm25 = BM25Okapi(tokenized)

    def hybrid_search(self, question, k=15):
        """벡터 검색 + BM25 검색 결합"""

        # 1. 벡터 검색
        vector_results = self.vector_store.search(question, k=k)

        # 벡터 결과 딕셔너리화
        combined = {}
        for doc, score in vector_results:
            combined[doc.page_content] = {
                'doc': doc,
                'score': score * 0.6,
                'metadata': doc.metadata
            }

        # 2. BM25 검색 (형태소 분석 기반, LLM 호출 없음)
        tokenized_query = self._tokenize(question)
        print(f"검색 토큰: {tokenized_query}")
        bm25_scores = self.bm25.get_scores(tokenized_query)

        top_bm25_idx = sorted(
            range(len(bm25_scores)),
            key=lambda i: bm25_scores[i],
            reverse=True
        )[:k]

        max_bm25 = max(bm25_scores[i] for i in top_bm25_idx) if top_bm25_idx else 1

        # 3. BM25 결과 합치기 (가중치 0.4)
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

        # 4. 점수 임계값 필터링 + 정렬
        sorted_results = sorted(
            combined.values(),
            key=lambda x: x['score'],
            reverse=True
        )

        # 최소 점수 기준: 상위 1개 점수의 30% 이상만 포함
        if sorted_results:
            threshold = sorted_results[0]['score'] * 0.3
            sorted_results = [r for r in sorted_results if r['score'] >= threshold]

        return sorted_results[:k]

    def _build_context(self, results):
        """하이브리드 검색 결과에서 컨텍스트와 출처 구성"""
        context = ""
        sources = []
        seen_contents = set()

        for item in results:
            if item['doc']:
                content = item['doc'].page_content
                metadata = item['doc'].metadata
            else:
                content = item.get('content', '')
                metadata = item.get('metadata', {})

            content_key = content[:100]
            if content_key in seen_contents:
                continue
            seen_contents.add(content_key)

            context += f"\n{content}\n"
            sources.append({
                'filename': metadata.get('source', ''),
                'page': metadata.get('page', ''),
                'article': metadata.get('article', ''),
                'content': content[:200]
            })

            if len(sources) >= 7:
                break

        return context, sources

    def ask_stream(self, question):
        """스트리밍 답변 생성 (stream 객체, sources 반환)"""
        results = self.hybrid_search(question, k=15)
        context, sources = self._build_context(results)
        prompt = self.prompt_template.format(context=context, question=question)

        stream = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1024,
            stream=True,
        )
        return stream, sources

    def ask(self, question, logger=None):
        results = self.hybrid_search(question, k=15)
        context, sources = self._build_context(results)
        prompt = self.prompt_template.format(context=context, question=question)

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1024,
        )
        answer = response.choices[0].message.content

        if logger:
            logger.log(question=question, answer=answer, sources=sources)

        return {'question': question, 'answer': answer, 'sources': sources}


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
