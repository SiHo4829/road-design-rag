import os
import json
import hashlib
from pdf_processor import load_all_pdfs_from_folder

class PDFMonitor:
    """PDF 폴더 변경 감지 클래스"""
    
    def __init__(self, data_folder="data", state_file="vectordb/pdf_state.json"):
        """
        Args:
            data_folder: PDF 폴더 경로
            state_file: PDF 상태 저장 파일
        """
        self.data_folder = data_folder
        self.state_file = state_file
        self.current_state = self._load_state()
    
    def _get_file_hash(self, filepath):
        """파일 해시값 계산 (변경 감지용)"""
        hasher = hashlib.md5()
        with open(filepath, 'rb') as f:
            hasher.update(f.read())
        return hasher.hexdigest()
    
    def _get_current_pdf_state(self):
        """현재 data 폴더의 PDF 상태 반환"""
        state = {}
        if os.path.exists(self.data_folder):
            for filename in os.listdir(self.data_folder):
                if filename.lower().endswith('.pdf'):
                    filepath = os.path.join(self.data_folder, filename)
                    state[filename] = self._get_file_hash(filepath)
        return state
    
    def _load_state(self):
        """저장된 PDF 상태 로드"""
        if os.path.exists(self.state_file):
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _save_state(self, state):
        """PDF 상태 저장"""
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    
    def check_changes(self):
        """
        PDF 변경사항 확인
        
        Returns:
            dict: 추가/삭제된 PDF 목록
        """
        new_state = self._get_current_pdf_state()
        
        # 새로 추가된 PDF
        added = [
            f for f in new_state 
            if f not in self.current_state
        ]
        
        # 삭제된 PDF
        removed = [
            f for f in self.current_state 
            if f not in new_state
        ]
        
        # 수정된 PDF
        modified = [
            f for f in new_state 
            if f in self.current_state 
            and new_state[f] != self.current_state[f]
        ]
        
        return {
            'added': added,
            'removed': removed,
            'modified': modified,
            'has_changes': bool(added or removed or modified)
        }
    
    def update_state(self):
        """현재 상태를 저장"""
        new_state = self._get_current_pdf_state()
        self._save_state(new_state)
        self.current_state = new_state
        print(f"✓ PDF 상태 업데이트 완료! ({len(new_state)}개 파일)")