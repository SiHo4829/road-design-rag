# === Stage 1: 프론트엔드 빌드 ===
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# === Stage 2: 백엔드 런타임 ===
FROM python:3.11-slim
WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY src/ ./src/
COPY run_api.py .

# 프론트엔드 빌드 결과물 복사
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# data, vectordb, logs 디렉토리 생성
RUN mkdir -p data vectordb logs

EXPOSE 8502

CMD ["python", "run_api.py"]
