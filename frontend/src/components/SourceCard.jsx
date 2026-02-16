const API_URL = "http://localhost:8502"

export default function SourceCard({ source, index }) {
  const pdfUrl = `${API_URL}/api/pdf/${encodeURIComponent(source.filename)}#page=${source.page}`

  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-gray-400 flex-shrink-0">[{index}]</span>
        <span className="text-gray-600 truncate">{source.filename}</span>
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