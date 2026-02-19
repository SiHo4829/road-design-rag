import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import SourceCard from "./SourceCard"

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
  code: ({ children }) => (
    <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-600 my-2 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 bg-gray-100 px-2 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-2 py-1.5">{children}</td>
  ),
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user"
  const [showSources, setShowSources] = useState(false)
  const hasSources = message.sources && message.sources.length > 0

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-5`}>
      <div className="max-w-2xl w-full">
        <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          {/* 아바타 */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
            ${isUser ? "bg-blue-500 text-white" : "bg-slate-700 text-white"}`}>
            {isUser ? "나" : "AI"}
          </div>

          <div className="flex-1">
            {/* 말풍선 */}
            <div className={`rounded-2xl px-4 py-3 text-sm
              ${isUser
                ? "bg-blue-500 text-white rounded-tr-none"
                : "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
              }`}>
              {isUser ? (
                <p className="leading-relaxed">{message.content}</p>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              )}
            </div>

            {/* 출처 */}
            {hasSources && (
              <div className="mt-2">
                <button
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-xs">{showSources ? "▼" : "▶"}</span>
                  <span>출처 {message.sources.length}개 {showSources ? "접기" : "펼치기"}</span>
                </button>

                {showSources && (
                  <div className="mt-1.5 space-y-1">
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
