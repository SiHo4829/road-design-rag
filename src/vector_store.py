from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_upstage import UpstageEmbeddings
from langchain_community.vectorstores import Chroma
import os
from dotenv import load_dotenv

load_dotenv()

class VectorStore:
    """텍스트를 벡터로 변환하고 저장하는 클래스"""
    
    def __init__(self, collection_name="road_design_docs", persist_directory="./vectordb"):
        """
        Args:
            collection_name: 컬렉션 이름
            persist_directory: 벡터 DB 저장 경로
        """
        self.collection_name = collection_name
        self.persist_directory = persist_directory
        
        # Upstage Solar 임베딩 (API 기반, 한국어 특화)
        self.embeddings = UpstageEmbeddings(
            model="solar-embedding-1-large",
            api_key=os.getenv("UPSTAGE_API_KEY")
        )
        
        # 텍스트 분할기 설정 (한국어 기술 문서 최적화)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,         # 한국어 문서에 맞게 축소 (정보 밀도가 높으므로 작은 청크가 검색 정밀도 향상)
            chunk_overlap=150,      # 30% 오버랩으로 문맥 손실 방지
            length_function=len,
            separators=[
                "\n\n",             # 문단 구분
                "\n",               # 줄바꿈
                "다.\n", "다. ",    # 한국어 평서문 종결
                "요.\n", "요. ",    # 한국어 존댓말 종결
                "음.\n", "음. ",    # 한국어 명사형 종결
                ".\n", ". ",        # 일반 문장 종결
                ", ",               # 쉼표
                " ",                # 공백
                ""                  # 최후 수단
            ]
        )
        
        self.vectorstore = None
    
    def create_chunks_from_pdf(self, pdf_processor):
        """
        PDF에서 추출한 텍스트를 청크로 분할
        
        Args:
            pdf_processor: PDFProcessor 객체
        
        Returns:
            list: 청크와 메타데이터 리스트
        """
        all_texts = pdf_processor.extract_all_text()
        pdf_info = pdf_processor.get_pdf_info()
        
        chunks_with_metadata = []
        
        for page_num, page_text in all_texts:
            # 텍스트가 비어있으면 스킵
            if not page_text.strip():
                continue
            
            # 텍스트를 청크로 분할
            chunks = self.text_splitter.split_text(page_text)
            
            # 각 청크에 메타데이터 + 컨텍스트 헤더 추가
            for chunk_idx, chunk in enumerate(chunks):
                metadata = {
                    'source': pdf_info['filename'],
                    'page': page_num,
                    'chunk': chunk_idx,
                    'total_pages': pdf_info['total_pages']
                }
                # 컨텍스트 헤더: 임베딩 시 출처 정보를 포함하여 검색 정확도 향상
                header = f"[{pdf_info['filename']} p.{page_num}] "
                chunks_with_metadata.append({
                    'text': header + chunk,
                    'metadata': metadata
                })
        
        return chunks_with_metadata
    
    def create_vectorstore(self, chunks_with_metadata):
        """
        청크들을 벡터로 변환하고 벡터 DB에 저장
        
        Args:
            chunks_with_metadata: 청크와 메타데이터 리스트
        
        Returns:
            Chroma: 벡터스토어 객체
        """
        print(f"총 {len(chunks_with_metadata)}개의 청크를 벡터로 변환 중...")
        
        # 텍스트와 메타데이터 분리
        texts = [item['text'] for item in chunks_with_metadata]
        metadatas = [item['metadata'] for item in chunks_with_metadata]
        
        # 벡터스토어 생성
        self.vectorstore = Chroma.from_texts(
            texts=texts,
            embedding=self.embeddings,
            metadatas=metadatas,
            collection_name=self.collection_name,
            persist_directory=self.persist_directory
        )
        
        print(f"✓ 벡터 DB 생성 완료! ({self.persist_directory})")
        return self.vectorstore
    
    def update_vectorstore(self, new_chunks):
        """
        기존 벡터 DB에 새 청크 추가
    
        Args:
            new_chunks: 추가할 청크 리스트
        """
        if not new_chunks:
            return
    
        texts = [item['text'] for item in new_chunks]
        metadatas = [item['metadata'] for item in new_chunks]
    
        self.vectorstore.add_texts(
            texts=texts,
            metadatas=metadatas
        )
        print(f"✓ {len(new_chunks)}개 청크 추가 완료!")
    
    def load_vectorstore(self):
        """기존 벡터 DB 로드"""
        if os.path.exists(self.persist_directory):
            self.vectorstore = Chroma(
                collection_name=self.collection_name,
                embedding_function=self.embeddings,
                persist_directory=self.persist_directory
            )
            print(f"✓ 기존 벡터 DB 로드 완료!")
            return self.vectorstore
        else:
            print(f"✗ 벡터 DB를 찾을 수 없습니다: {self.persist_directory}")
            return None
    
    def search(self, query, k=3):
        """
        질의와 유사한 문서 검색
        
        Args:
            query: 검색 질의
            k: 반환할 문서 개수
        
        Returns:
            list: 검색된 문서 리스트
        """
        if self.vectorstore is None:
            raise ValueError("벡터스토어가 초기화되지 않았습니다.")
        
        results = self.vectorstore.similarity_search_with_score(query, k=k)
        # 거리 → 유사도 변환 (0~1 사이로 정규화)
        normalized = []
        for doc, score in results:
            similarity = 1 / (1 + score)  # 거리를 유사도로 변환
            normalized.append((doc, similarity))
        return normalized


# 테스트 코드
if __name__ == "__main__":
    from pdf_processor import load_all_pdfs_from_folder
    
    print("=" * 60)
    print("벡터 DB 생성 테스트")
    print("=" * 60)
    
    # 1. PDF 파일 로드
    print("\n[1단계] PDF 파일 로드 중...")
    processors = load_all_pdfs_from_folder("data")
    
    if not processors:
        print("✗ PDF 파일이 없습니다!")
        exit()
    
    # 2. 벡터스토어 초기화
    print("\n[2단계] 벡터스토어 초기화...")
    vector_store = VectorStore()
    
    # 3. 모든 PDF를 청크로 변환
    print("\n[3단계] 텍스트 청크 생성 중...")
    all_chunks = []
    for processor in processors:
        chunks = vector_store.create_chunks_from_pdf(processor)
        all_chunks.extend(chunks)
        print(f"  - {processor.get_pdf_info()['filename']}: {len(chunks)}개 청크")
    
    print(f"\n총 청크 개수: {len(all_chunks)}")
    
    # 4. 벡터 DB 생성
    print("\n[4단계] 벡터 DB 생성 중... (시간 소요될 수 있음)")
    vector_store.create_vectorstore(all_chunks)
    
    # 5. 검색 테스트
    print("\n[5단계] 검색 테스트")
    test_query = "도로의 설계속도는?"
    print(f"질문: {test_query}")
    print("-" * 60)
    
    results = vector_store.search(test_query, k=2)
    
    for i, (doc, score) in enumerate(results, 1):
        print(f"\n검색 결과 {i} (유사도: {score:.4f})")
        print(f"출처: {doc.metadata['source']} - 페이지 {doc.metadata['page']}")
        print(f"내용: {doc.page_content[:200]}...")
    
    print("\n" + "=" * 60)
    print("벡터 DB 생성 및 테스트 완료!")