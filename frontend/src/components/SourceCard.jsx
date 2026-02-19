import { FileText, ExternalLink } from "lucide-react"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function SourceCard({ source, index }) {
  const pdfUrl = `${API_URL}/api/pdf/${encodeURIComponent(source.filename)}#page=${source.page}`
  const lawName = source.filename.replace(/\(.*?\)\.pdf$/i, "").replace(/\.pdf$/i, "").trim()

  return (
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
        <div className="flex flex-col min-w-0 gap-0.5">
          <span className="text-xs text-foreground truncate font-medium">{lawName}</span>
          {source.article && (
            <span className="text-[11px] text-primary font-medium">{source.article}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => window.open(pdfUrl, "_blank")}
        className={cn(
          "flex-shrink-0 ml-3 flex items-center gap-1",
          "px-2.5 py-1 rounded-lg",
          "bg-accent text-primary text-[11px] font-medium",
          "hover:bg-primary hover:text-white transition-colors"
        )}
      >
        <ExternalLink className="h-3 w-3" />
        {source.page}p
      </button>
    </div>
  )
}
