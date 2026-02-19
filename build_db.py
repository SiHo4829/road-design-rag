"""
벡터 DB 최초 구축 스크립트
EC2 배포 후 PDF 업로드 뒤 한 번 실행하세요.

사용법:
  python build_db.py
"""

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from vector_store import VectorStore
from pdf_processor import load_all_pdfs_from_folder


def build():
    print("=" * 60)
    print("벡터 DB 구축 시작")
    print("=" * 60)

    processors = load_all_pdfs_from_folder("data")
    if not processors:
        print("✗ data/ 폴더에 PDF 파일이 없습니다!")
        print("  data/ 폴더에 PDF를 업로드한 후 다시 실행하세요.")
        return False

    vector_store = VectorStore()

    all_chunks = []
    for processor in processors:
        chunks = vector_store.create_chunks_from_pdf(processor)
        all_chunks.extend(chunks)
        print(f"  ✓ {processor.get_pdf_info()['filename']}: {len(chunks)}개 청크")

    print(f"\n총 {len(all_chunks)}개 청크 → 벡터 DB 생성 중... (수분 소요)")
    vector_store.create_vectorstore(all_chunks)

    print("\n✓ 벡터 DB 구축 완료! 이제 서버를 시작할 수 있습니다.")
    print("  docker compose up -d")
    return True


if __name__ == "__main__":
    build()
