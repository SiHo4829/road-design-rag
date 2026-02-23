import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bot, User, Copy, Check, BookOpen, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Zap } from "lucide-react"
import SourceCard from "./SourceCard"
import CalcWidget from "./CalcWidget"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Tooltip } from "./ui/tooltip"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0 text-foreground">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0 text-foreground">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-foreground">{children}</h3>,
  code: ({ children }) => (
    <code className="bg-muted text-foreground px-1.5 py-0.5 rounded text-xs font-mono border border-border">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground my-2 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-lg border border-border">
      <table className="text-xs border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-muted px-3 py-2 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 last:border-b-0">{children}</td>
  ),
}

const highlightText = (text, query) => {
  if (!query) return text
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts = []
  let last = 0
  let pos = lowerText.indexOf(lowerQuery)
  while (pos !== -1) {
    parts.push(text.slice(last, pos))
    parts.push(
      <mark key={pos} className="bg-yellow-200 dark:bg-yellow-700/60 rounded px-0.5 text-inherit">
        {text.slice(pos, pos + query.length)}
      </mark>
    )
    last = pos + query.length
    pos = lowerText.indexOf(lowerQuery, last)
  }
  parts.push(text.slice(last))
  return parts
}

export default function MessageBubble({ message, sessionId, prevQuestion, onRelatedClick, highlighted, searchQuery }) {
  const isUser = message.role === "user"
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rated, setRated] = useState(null) // null | 1 | -1
  const hasSources = message.sources && message.sources.length > 0

  const handleCopy = () => {
    const text = message.content
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } else {
      // HTTP 환경 fallback
      const el = document.createElement("textarea")
      el.value = text
      el.style.position = "fixed"
      el.style.opacity = "0"
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRate = async (r) => {
    if (rated || !prevQuestion) return
    setRated(r)
    try {
      await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question: prevQuestion, rating: r }),
      })
    } catch {}
  }

  // 설계 파라미터 산출 위젯
  if (message.type === "calc") {
    return (
      <div className="flex justify-start mb-5">
        <div className="flex items-start gap-3 w-full max-w-2xl">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <CalcWidget />
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-5">
        <div className="max-w-2xl flex items-end gap-2.5">
          <div className={cn(
            "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-sm",
            highlighted && "ring-2 ring-yellow-300 dark:ring-yellow-500"
          )}>
            {searchQuery ? highlightText(message.content, searchQuery) : message.content}
          </div>
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mb-0.5">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-5">
      <div className="max-w-2xl w-full flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn(
            "bg-background border border-border rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm text-foreground shadow-sm",
            highlighted && "ring-2 ring-yellow-300 dark:ring-yellow-500 border-yellow-300 dark:border-yellow-500"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>

          {message.content && !message.isError && (
            <div className="flex items-center gap-1 mt-1.5 ml-1 flex-wrap">
              {/* 캐시 뱃지 */}
              {message.fromCache && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5 mr-1">
                  <Zap className="h-2.5 w-2.5" />
                  캐시
                </Badge>
              )}

              {/* 복사 버튼 */}
              <Tooltip content={copied ? "복사됨!" : "복사"}>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                  {copied
                    ? <Check className="h-3 w-3 text-green-500" />
                    : <Copy className="h-3 w-3 text-muted-foreground" />
                  }
                </Button>
              </Tooltip>

              {/* 답변 평가 버튼 */}
              {prevQuestion && (
                <>
                  <Tooltip content="도움이 됐어요">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRate(1)}
                      disabled={!!rated}
                    >
                      <ThumbsUp className={cn(
                        "h-3 w-3",
                        rated === 1 ? "text-green-500" : "text-muted-foreground"
                      )} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="도움이 안 됐어요">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRate(-1)}
                      disabled={!!rated}
                    >
                      <ThumbsDown className={cn(
                        "h-3 w-3",
                        rated === -1 ? "text-red-500" : "text-muted-foreground"
                      )} />
                    </Button>
                  </Tooltip>
                </>
              )}

              {/* 출처 토글 */}
              {hasSources && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground"
                  onClick={() => setShowSources(!showSources)}
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  출처 {message.sources.length}개
                  {showSources
                    ? <ChevronUp className="h-3 w-3 ml-1" />
                    : <ChevronDown className="h-3 w-3 ml-1" />
                  }
                </Button>
              )}
            </div>
          )}

          {showSources && (
            <div className="mt-2 space-y-1.5">
              {message.sources.map((source, i) => (
                <SourceCard key={i} source={source} index={i + 1} />
              ))}
            </div>
          )}

          {/* 연관 질문 칩 */}
          {!message.isError && message.relatedQuestions?.length > 0 && (
            <div className="mt-2.5 space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium ml-0.5">관련 질문</p>
              {message.relatedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onRelatedClick?.(q)}
                  className={cn(
                    "block w-full text-left text-xs px-3 py-2 rounded-xl",
                    "border border-border bg-background",
                    "hover:border-primary hover:text-primary hover:bg-accent",
                    "transition-colors duration-150 leading-relaxed"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
