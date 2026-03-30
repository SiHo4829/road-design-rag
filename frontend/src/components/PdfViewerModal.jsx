import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { X, ZoomIn, ZoomOut, Download } from "lucide-react"

const isAndroid = /Android/i.test(navigator.userAgent)

pdfjs.GlobalWorkerOptions.workerSrc = isAndroid
  ? `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`
  : new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

const API_URL = import.meta.env.VITE_API_URL || ""

export default function PdfViewerModal({ filename, initialPage = 1, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(Number(initialPage) || 1)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState(null)
  const pageRefs = useRef({})
  const pageVisibility = useRef({})
  const observerRef = useRef(null)
  const scrolledRef = useRef(false)

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
      .catch(() => setError(true))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pdfUrl])

  // 초기 페이지로 스크롤 (최초 1회)
  useEffect(() => {
    if (!numPages || scrolledRef.current) return
    scrolledRef.current = true
    requestAnimationFrame(() => {
      const el = pageRefs.current[Number(initialPage)]
      if (el) el.scrollIntoView({ behavior: "instant" })
    })
  }, [numPages])

  // 현재 보이는 페이지 추적
  useEffect(() => {
    if (!numPages) return
    observerRef.current?.disconnect()

    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const page = Number(entry.target.dataset.page)
          if (page) pageVisibility.current[page] = entry.intersectionRatio
        })
        const visible = Object.entries(pageVisibility.current)
          .filter(([, r]) => r > 0)
          .sort(([, a], [, b]) => b - a)
        if (visible.length > 0) setCurrentPage(Number(visible[0][0]))
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    Object.values(pageRefs.current).forEach(el => {
      if (el) observerRef.current.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [numPages])

  const zoomIn = () => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)))
  const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))

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

        <span className="text-xs tabular-nums text-foreground flex-shrink-0 select-none min-w-[64px] text-center">
          {currentPage} / {numPages ?? "…"}
        </span>

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

      {/* PDF 스크롤 영역 */}
      <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800">
        {error ? (
          <div className="flex flex-col items-center gap-3 mt-20 text-muted-foreground text-sm">
            <p>PDF를 불러오지 못했습니다.</p>
            <a href={pdfUrl} download={filename} className="text-primary underline">파일 다운로드</a>
          </div>
        ) : !blobUrl ? (
          <div className="mt-20 text-sm text-muted-foreground animate-pulse text-center">
            PDF 로딩 중…
          </div>
        ) : (
          <Document
            file={blobUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setError(true)}
          >
            {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
              <div
                key={page}
                ref={el => { pageRefs.current[page] = el }}
                data-page={page}
                className="flex justify-center py-2"
              >
                <Page
                  pageNumber={page}
                  scale={scale}
                  renderTextLayer
                  renderAnnotationLayer
                  className="shadow-lg"
                  loading={
                    <div
                      style={{ width: Math.round(595 * scale), height: Math.round(842 * scale) }}
                      className="bg-white dark:bg-gray-700 flex items-center justify-center"
                    >
                      <span className="text-xs text-gray-400 animate-pulse">{page}p</span>
                    </div>
                  }
                />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
