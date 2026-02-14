import pdfplumber
import os

class PDFProcessor:
    """PDF 파일을 읽고 텍스트를 추출하는 클래스"""
    
    def __init__(self, pdf_path):
        self.pdf_path = os.path.abspath(pdf_path)
        
        if not os.path.exists(self.pdf_path):
            raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {self.pdf_path}")
        
        self.pdf = pdfplumber.open(self.pdf_path)
        self.total_pages = len(self.pdf.pages)
        
        # 테이블 추출 설정 (최적화)
        self.table_settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "snap_tolerance": 5,
            "join_tolerance": 5,
            "edge_min_length": 10,
            "min_words_vertical": 1,
            "min_words_horizontal": 1,
        }
    
    def clean_cell(self, cell):
        """
        셀 데이터 정리
        - None 처리
        - 줄바꿈 정리
        - 공백 정리
        """
        if cell is None:
            return ""
        # 줄바꿈을 공백으로 변환
        cell = str(cell).replace('\n', ' ')
        # 연속 공백 제거
        cell = ' '.join(cell.split())
        return cell.strip()
    
    def table_to_text(self, table):
        """
        테이블을 AI가 이해하기 쉬운 텍스트로 변환
        병합 셀, 빈 셀 최대한 처리
        """
        if not table:
            return ""
        
        # 빈 행 제거
        table = [row for row in table if any(cell for cell in row)]
        if not table:
            return ""
        
        result = []
        
        # 셀 정리
        cleaned_table = []
        for row in table:
            cleaned_row = [self.clean_cell(cell) for cell in row]
            cleaned_table.append(cleaned_row)
        
        # 헤더 찾기 (첫 번째 비어있지 않은 행)
        headers = cleaned_table[0]
        
        # 헤더 행 출력
        header_line = " | ".join([h for h in headers if h])
        result.append(header_line)
        result.append("-" * len(header_line))
        
        # 데이터 행 출력
        for row in cleaned_table[1:]:
            row_data = []
            for header, value in zip(headers, row):
                if value:  # 값 있을 때만
                    if header:
                        row_data.append(f"{header}: {value}")
                    else:
                        row_data.append(value)
            
            if row_data:
                result.append(", ".join(row_data))
        
        return "\n".join(result)
    
    def extract_text_from_page(self, page_num):
        """
        특정 페이지에서 텍스트 + 테이블 추출
        텍스트와 테이블 영역 분리하여 중복 방지
        """
        page = self.pdf.pages[page_num]
        result = []
        
        try:
            # 1. 테이블 영역 먼저 찾기
            tables = page.extract_tables(self.table_settings)
            
            # 테이블 없으면 텍스트만 추출
            if not tables:
                text = page.extract_text()
                if text:
                    result.append(text.strip())
            else:
                # 2. 테이블 bbox 찾기 (테이블 위치)
                table_bboxes = []
                for table_obj in page.find_tables(self.table_settings):
                    table_bboxes.append(table_obj.bbox)
                
                # 3. 테이블 제외한 텍스트 추출
                if table_bboxes:
                    # 테이블 영역 제외하고 텍스트 추출
                    non_table_text = page.extract_text()
                    if non_table_text:
                        result.append(non_table_text.strip())
                
                # 4. 테이블 텍스트로 변환하여 추가
                result.append("\n[표 데이터]")
                for table in tables:
                    table_text = self.table_to_text(table)
                    if table_text:
                        result.append(table_text)
                        result.append("")  # 테이블 구분
        
        except Exception as e:
            # 오류 시 기본 텍스트 추출로 폴백
            text = page.extract_text()
            if text:
                result.append(text.strip())
        
        return "\n".join(result)
    
    def extract_all_text(self):
        """모든 페이지의 텍스트를 추출"""
        all_text = []
        for page_num in range(self.total_pages):
            try:
                text = self.extract_text_from_page(page_num)
                all_text.append((page_num + 1, text))
            except Exception as e:
                print(f"  ⚠️ 페이지 {page_num + 1} 추출 오류: {e}")
                all_text.append((page_num + 1, ""))
        return all_text
    
    def get_pdf_info(self):
        """PDF 정보 반환"""
        return {
            'filename': os.path.basename(self.pdf_path),
            'total_pages': self.total_pages,
            'filepath': self.pdf_path
        }
    
    def __del__(self):
        """소멸자: PDF 파일 닫기"""
        if hasattr(self, 'pdf'):
            self.pdf.close()


def load_all_pdfs_from_folder(folder_path):
    """폴더 내 모든 PDF 파일 로드"""
    pdf_processors = []
    
    for filename in os.listdir(folder_path):
        if filename.lower().endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            try:
                processor = PDFProcessor(pdf_path)
                pdf_processors.append(processor)
                print(f"✓ 로드 성공: {filename}")
            except Exception as e:
                print(f"✗ 로드 실패: {filename} - {e}")
    
    return pdf_processors

# 테스트 코드
if __name__ == "__main__":
    data_folder = "data"
    print("=" * 60)
    print("pdfplumber 최적화 테스트")
    print("=" * 60)
    
    processors = load_all_pdfs_from_folder(data_folder)
    
    for processor in processors:
        info = processor.get_pdf_info()
        print(f"\n파일명: {info['filename']}")
        print(f"총 페이지: {info['total_pages']}")
        
        # 테이블 있는 페이지 찾아서 출력
        print("\n테이블 포함 페이지 검색 중...")
        table_count = 0
        for page_num in range(processor.total_pages):
            page = processor.pdf.pages[page_num]
            tables = page.extract_tables(processor.table_settings)
            if tables:
                table_count += 1
                if table_count <= 3:  # 처음 3개만 출력
                    print(f"\n[페이지 {page_num + 1}] 테이블 {len(tables)}개 발견!")
                    print("-" * 40)
                    text = processor.extract_text_from_page(page_num)
                    print(text[:800])
                    print("...")
        
        print(f"\n총 테이블 포함 페이지: {table_count}개")