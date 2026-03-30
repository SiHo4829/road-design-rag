import { useState } from "react"
import { createPortal } from "react-dom"
import { X, Download, RefreshCw } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || window.location.origin

export default function PdfViewerModal({ filename, onClose }) {
  const [key, setKey] = useState(0)

  const pdfUrl = `${API_URL}/api/pdf/${encodeURIComponent(filename)}`
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`
  const lawName = filename.replace(/\(.*?\)\.pdf$/i, "").replace(/\.pdf$/i, "").trim()

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

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setKey(k => k + 1)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            title="새로고침"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
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
      </div>

      {/* Google Docs Viewer iframe */}
      <iframe
        key={key}
        src={viewerUrl}
        className="flex-1 w-full border-0"
        title={lawName}
        allow="autoplay"
      />
    </div>
  )

  return createPortal(modal, document.body)
}
