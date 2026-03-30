import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from "lucide-react"

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function PdfViewerModal({ filename, initialPage = 1, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(Number(initialPage) || 1)
  const [scale, setScale] = useState(0.8)
  const [error, setError] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")

  const pdfUrl = `${API_URL}/api/pdf/${encodeURIComponent(filename)}`
  const lawName = filename.replace(/\(.*?\)\.pdf$/i, "").replace(/\.pdf$/i, "").trim()

  // PDF를 Blob으로 fetch
  useEffect(() => {
    let objectUrl = null
    fetch(pdfUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch(e => { setError(true); setErrorMsg(`fetch 실패: ${e.message}`) })

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pdfUrl])

  const zoomIn = () => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)))
  const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))
  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1))
  const nextPage = () => setCurrentPage(p => Math.min(numPages, p + 1))

  const modal = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* 툴바 */}
      <div className="bg-background border-b border-border flex items-center gap-2 px-3 py-2 flex-shrink-0">
        <span className="text-xs font-semibold text-foreground truncate flex-1 min-w-0">
          {lawName}
        </span>

        {/* 페이지 네비게이션 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={prevPage} disabled={currentPage <= 1} className="p-1.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-30" aria-label="이전 페이지">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-foreground select-none min-w-[56px] text-center">
            {currentPage} / {numPages ?? "…"}
          </span>
          <button onClick={nextPage} disabled={!numPages || currentPage >= numPages} className="p-1.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-30" aria-label="다음 페이지">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 줌 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={zoomOut} className="p-1.5 rounded-lg hover:bg-accent transition-colors" aria-label="축소">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn} className="p-1.5 rounded-lg hover:bg-accent transition-colors" aria-label="확대">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <a
          href={pdfUrl}
          download={filename}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors flex-shrink-0"
          title="다운로드"
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors flex-shrink-0"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* PDF 영역 - 한 페이지만 렌더링 */}
      <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800 flex justify-center">
        {error ? (
          <div className="flex flex-col items-center gap-3 mt-20 text-muted-foreground text-sm">
            <p>PDF를 불러오지 못했습니다.</p>
            {errorMsg && <p className="text-[11px] text-red-400 font-mono px-4 text-center">{errorMsg}</p>}
            <a href={pdfUrl} download={filename} className="text-primary underline">파일 다운로드</a>
          </div>
        ) : !blobUrl ? (
          <p className="mt-20 text-sm text-muted-foreground animate-pulse">PDF 로딩 중…</p>
        ) : (
          <Document
            file={blobUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={e => { setError(true); setErrorMsg(`PDF 파싱 실패: ${e?.message}`) }}
            loading={<p className="mt-20 text-sm text-muted-foreground animate-pulse">PDF 로딩 중…</p>}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer
              renderAnnotationLayer
              className="shadow-lg my-2"
            />
          </Document>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
