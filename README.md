# road-design-rag

도로 설계 기준 문서를 기반으로 질문에 답변하는 RAG(Retrieval-Augmented Generation) 기반 AI 챗봇입니다.  
사용자가 도로 설계 기준에 대해 질문하면 관련 문서를 검색한 후 LLM을 통해 답변을 생성합니다.

# 프로젝트 배경

AI의 발전과 함께 바이브 코딩을 활용해 프로젝트를 시작했습니다.  
초기에는 AI가 생성한 코드를 기반으로 빠르게 기능을 구현했지만, 프로젝트가 커질수록 코드 구조와 동작 원리를 완전히 이해하지 못하고 있다는 문제를 느끼게 되었습니다.

이 프로젝트는 단순히 기능을 만드는 것을 넘어  
RAG 구조와 백엔드 동작을 직접 이해하는 것을 목표로 개선해 나가고 있습니다.

# 주요 기능

- 도로 설계 기준 문서 기반 질문 응답
- RAG 기반 문서 검색 + LLM 응답 생성
- 관련 문서 기반 답변 생성
- AI 챗봇 인터페이스 제공

# 기술 스택

Backend
- FastAPI

Frontend
- React

AI / LLM
- Groq API
- LangChain

Vector Database
- Chroma

# 시스템 구조

User  
↓  
Frontend (React)  
↓  
Backend API (FastAPI)  
↓  
Embedding 생성  
↓  
Vector DB 검색 (Chroma)  
↓  
LLM 응답 생성 (Groq)

# 작동 과정

1. 사용자가 질문 입력
2. 질문을 임베딩하여 VectorDB에서 관련 문서 검색
3. 검색된 문서를 기반으로 LLM에 프롬프트 생성
4. LLM이 문맥 기반 답변 생성
5. 결과 반환

# 배운 점

- RAG 구조의 동작 방식 이해
- LLM을 활용한 서비스 아키텍처 경험
- 문서 기반 검색 시스템 구현 경험
- AI 기반 개발 과정에서 코드 이해의 중요성

# 향후 개선 방향

- 검색 정확도 개선
- 문서 chunking 방식 개선
- 프롬프트 최적화
- 응답 품질 개선
