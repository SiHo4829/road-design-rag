import os
import json
import hashlib
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class PDFMonitor:
    """PDF 폴더 변경 감지 클래스"""

    def __init__(self, data_folder="data", state_file="vectordb/pdf_state.json"):
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
        """PDF 변경사항 확인"""
        new_state = self._get_current_pdf_state()

        added = [f for f in new_state if f not in self.current_state]
        removed = [f for f in self.current_state if f not in new_state]
        modified = [
            f for f in new_state
            if f in self.current_state and new_state[f] != self.current_state[f]
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


class PDFWatcher:
    """data 폴더를 감시하여 PDF 추가/변경 시 자동으로 벡터 DB 업데이트"""

    def __init__(self, data_folder="data", on_update=None):
        self.data_folder = os.path.abspath(data_folder)
        self.on_update = on_update
        self._observer = None
        self._debounce_timer = None
        self._pending_files = set()
        self._lock = threading.Lock()

    def _process_pending(self):
        """디바운스 후 대기 중인 파일들을 일괄 처리"""
        with self._lock:
            files = list(self._pending_files)
            self._pending_files.clear()

        if files and self.on_update:
            print(f"\n📄 변경 감지: {files}")
            try:
                self.on_update(files)
            except Exception as e:
                print(f"⚠ 자동 업데이트 실패: {e}")

    def _schedule_processing(self, filepath):
        """파일 변경 시 2초 디바운스 후 처리 (복사 완료 대기)"""
        filename = os.path.basename(filepath)
        if not filename.lower().endswith('.pdf'):
            return

        with self._lock:
            self._pending_files.add(filename)

        if self._debounce_timer:
            self._debounce_timer.cancel()
        self._debounce_timer = threading.Timer(2.0, self._process_pending)
        self._debounce_timer.start()

    def start(self):
        """폴더 감시 시작 (백그라운드 스레드)"""
        os.makedirs(self.data_folder, exist_ok=True)

        handler = _PDFEventHandler(self._schedule_processing)
        self._observer = Observer()
        self._observer.schedule(handler, self.data_folder, recursive=False)
        self._observer.daemon = True
        self._observer.start()
        print(f"👁 PDF 폴더 감시 시작: {self.data_folder}")

    def stop(self):
        """폴더 감시 중지"""
        if self._observer:
            self._observer.stop()
            self._observer.join()
        if self._debounce_timer:
            self._debounce_timer.cancel()


class _PDFEventHandler(FileSystemEventHandler):
    """watchdog 이벤트 핸들러"""

    def __init__(self, callback):
        self.callback = callback

    def on_created(self, event):
        if not event.is_directory:
            self.callback(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self.callback(event.src_path)
