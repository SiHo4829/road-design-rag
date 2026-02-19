import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bot, User, Copy, Check, BookOpen, ChevronDown, ChevronUp } from "lucide-react"
import SourceCard from "./SourceCard"
import { Button } from "./ui/button"
import { Tooltip } from "./ui/tooltip"

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

export default function MessageBubble({ message }) {
  const isUser = message.role === "user"
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasSources = message.sources && message.sources.length > 0

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-5">
        <div className="max-w-2xl flex items-end gap-2.5">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
            {message.content}
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
          <div className="bg-background border border-border rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm text-foreground shadow-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>

          {message.content && (
            <div className="flex items-center gap-1 mt-1.5 ml-1">
              <Tooltip content={copied ? "복사됨!" : "복사"}>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                  {copied
                    ? <Check className="h-3 w-3 text-green-500" />
                    : <Copy className="h-3 w-3 text-muted-foreground" />
                  }
                </Button>
              </Tooltip>

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
        </div>
      </div>
    </div>
  )
}
