const API_URL = import.meta.env.VITE_API_URL || ""

export default function SourceCard({ source, index }) {
  const pdfUrl = `${API_URL}/api/pdf/${encodeURIComponent(source.filename)}#page=${source.page}`

  // 파일명에서 법률명 축약 (괄호 이전까지)
  const lawName = source.filename.replace(/\(.*?\)\.pdf$/, "").replace(/\.pdf$/, "").trim()

  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-gray-400 flex-shrink-0">[{index}]</span>
        <div className="flex flex-col min-w-0">
          <span className="text-gray-600 truncate">{lawName}</span>
          {source.article && (
            <span className="text-blue-500 font-medium">{source.article}</span>
          )}
        </div>
      </div>
      <button
        onClick={() => window.open(pdfUrl, '_blank')}
        className="flex-shrink-0 ml-2 px-2 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
      >
        📄 {source.page}p
      </button>
    </div>
  )
}
