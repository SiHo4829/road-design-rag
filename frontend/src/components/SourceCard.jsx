import { useState } from "react"
import { FileText, ExternalLink } from "lucide-react"
import { Tooltip } from "./ui/tooltip"
import { cn } from "../lib/utils"
import PdfViewerModal from "./PdfViewerModal"

const API_URL = import.meta.env.VITE_API_URL || ""

const isAndroid = /Android/i.test(navigator.userAgent)

export default function SourceCard({ source, index }) {
  const [showPdf, setShowPdf] = useState(false)

  // PDF 뷰어 이동은 실제 PDF 페이지 인덱스(source.page) 사용
  // 버튼 표시는 문서에 인쇄된 페이지 번호(source.printed_page) 우선 사용
  const displayPage = source.printed_page ?? source.page
  const pdfUrl = `${API_URL}/api/pdf/${encodeURIComponent(source.filename)}#page=${source.page}`
  const lawName = source.filename.replace(/\(.*?\)\.pdf$/i, "").replace(/\.pdf$/i, "").trim()
  const citation = [source.chapter, source.section, source.article].filter(Boolean).join(" ")

  const handleOpen = () => {
    if (isAndroid) {
      setShowPdf(true)
    } else {
      window.open(pdfUrl, "_blank")
    }
  }

  return (
    <>
      <div className={cn(
        "flex items-center justify-between",
        "bg-background border border-border rounded-xl px-3 py-2.5",
        "hover:border-primary/40 hover:bg-accent/50 transition-colors shadow-sm"
      )}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-muted-foreground flex-shrink-0 tabular-nums">
            [{index}]
          </span>
          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <Tooltip content={source.content || "내용 없음"}>
            <div className="flex flex-col min-w-0 gap-0.5 cursor-default">
              <span className="text-xs text-foreground truncate font-medium">출처: {lawName}</span>
              {citation && (
                <span className="text-[11px] text-primary font-medium">{citation}</span>
              )}
            </div>
          </Tooltip>
        </div>

        <button
          onClick={handleOpen}
          className={cn(
            "flex-shrink-0 ml-3 flex items-center gap-1",
            "px-2.5 py-1 rounded-lg",
            "bg-accent text-primary text-[11px] font-medium",
            "hover:bg-primary hover:text-white transition-colors"
          )}
        >
          <ExternalLink className="h-3 w-3" />
          {displayPage}p
        </button>
      </div>

      {showPdf && (
        <PdfViewerModal
          filename={source.filename}
          initialPage={source.page || 1}
          onClose={() => setShowPdf(false)}
        />
      )}
    </>
  )
}
