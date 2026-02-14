import json
import os
from datetime import datetime

class Logger:
    """질문/답변 로그 기록 클래스"""
    
    def __init__(self, session_id, log_dir="logs"):
        """
        Args:
            session_id: 세션 ID
            log_dir: 로그 저장 폴더
        """
        self.session_id = session_id
        
        # 세션별 폴더 생성
        self.log_dir = os.path.join(log_dir, session_id)
        os.makedirs(self.log_dir, exist_ok=True)
        
        # 로그 파일명 (날짜별)
        today = datetime.now().strftime("%Y-%m-%d")
        self.log_file = os.path.join(self.log_dir, f"log_{today}.json")
        
        # 기존 로그 로드 또는 새로 생성
        self.logs = self._load_logs()
    
    def _load_logs(self):
        """기존 로그 파일 로드"""
        if os.path.exists(self.log_file):
            with open(self.log_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    
    def _save_logs(self):
        """로그 파일 저장"""
        with open(self.log_file, 'w', encoding='utf-8') as f:
            json.dump(self.logs, f, ensure_ascii=False, indent=2)
    
    def log(self, question, answer, sources):
        """
        질문/답변 로그 기록
        
        Args:
            question: 질문
            answer: 답변
            sources: 출처 리스트
        """
        log_entry = {
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'session_id': self.session_id,
            'question': question,
            'answer': answer,
            'sources': [
                {
                    'filename': s['filename'],
                    'page': s['page'],
                    'content_preview': s['content']
                }
                for s in sources
            ]
        }
        
        self.logs.append(log_entry)
        self._save_logs()
        return log_entry
    
    def get_logs(self, date=None):
        """
        로그 조회
        
        Args:
            date: 조회할 날짜 (예: "2026-02-10"), None이면 오늘
        
        Returns:
            list: 로그 리스트
        """
        if date:
            log_file = os.path.join(self.log_dir, f"log_{date}.json")
            if os.path.exists(log_file):
                with open(log_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        return self.logs
    
    def get_all_log_dates(self):
        """저장된 모든 로그 날짜 반환"""
        dates = []
        for filename in os.listdir(self.log_dir):
            if filename.startswith("log_") and filename.endswith(".json"):
                date = filename.replace("log_", "").replace(".json", "")
                dates.append(date)
        return sorted(dates, reverse=True)