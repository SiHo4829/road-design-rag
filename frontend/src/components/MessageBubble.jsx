import { useState } from "react"
import SourceCard from "./SourceCard"

export default function MessageBubble({ message }) {
  const isUser = message.role === "user"
  const [showSources, setShowSources] = useState(false)
  const hasSources = message.sources && message.sources.length > 0

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className="max-w-2xl w-full">
        <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          {/* 아바타 */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0
            ${isUser ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}>
            {isUser ? "👤" : "🤖"}
          </div>

          <div className="flex-1">
            {/* 말풍선 */}
            <div className={`rounded-2xl px-4 py-3 text-sm
              ${isUser
                ? "bg-blue-500 text-white rounded-tr-none"
                : "bg-gray-100 text-gray-800 rounded-tl-none"
              }`}>
              {message.content}
            </div>

            {/* 출처 토글 버튼 */}
            {hasSources && (
              <div className="mt-2">
                <button
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span>{showSources ? "▼" : "▶"}</span>
                  <span>출처 {message.sources.length}개</span>
                  <span>{showSources ? "접기" : "펼치기"}</span>
                </button>

                {/* 출처 목록 */}
                {showSources && (
                  <div className="mt-1 space-y-1">
                    {message.sources.map((source, i) => (
                      <SourceCard key={i} source={source} index={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}