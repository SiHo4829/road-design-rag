import { useState, useRef, useEffect } from "react"
import { Route, MessageSquare, Send, RotateCcw, Plus, Bot } from "lucide-react"
import MessageBubble from "./MessageBubble"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""

const EXAMPLE_QUESTIONS = [
  "설계속도란 무엇인가요?",
  "차로의 최소 폭 기준은?",
  "주간선도로의 종단경사 제한은?",
  "시거 기준은 어떻게 되나요?",
]

export default function ChatBox({ sessionId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (question, overrideHistory) => {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput("")

    const history = overrideHistory ?? messages.map(m => ({ role: m.role, content: m.content }))

    if (overrideHistory === undefined) {
      setMessages(prev => [...prev, { role: "user", content: q }])
    }
    setMessages(prev => [...prev, { role: "assistant", content: "", sources: [] }])
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, session_id: sessionId, history })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6)
          if (data === "[DONE]") break

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === "token") {
              setMessages(prev => {
                const msgs = [...prev]
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  content: msgs[msgs.length - 1].content + parsed.content
                }
                return msgs
              })
            } else if (parsed.type === "sources") {
              setMessages(prev => {
                const msgs = [...prev]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], sources: parsed.sources }
                return msgs
              })
            } else if (parsed.type === "error") {
              setMessages(prev => {
                const msgs = [...prev]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "오류가 발생했습니다." }
                return msgs
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "오류가 발생했습니다. 다시 시도해주세요." }
        return msgs
      })
    } finally {
      setLoading(false)
    }
  }

  const regenerate = async () => {
    const lastUserIdx = [...messages].map(m => m.role).lastIndexOf("user")
    if (lastUserIdx < 0) return
    const lastQ = messages[lastUserIdx].content
    const historyBefore = messages.slice(0, lastUserIdx).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => prev.slice(0, lastUserIdx + 1))
    await sendMessage(lastQ, historyBefore)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canRegenerate = !loading && messages.length > 0 && messages[messages.length - 1].role === "assistant"

  return (
    <div className="flex-1 flex flex-col h-screen bg-background min-w-0">
      {/* 헤더 */}
      <header className="px-6 py-3.5 bg-background border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">Roadspec</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">
              도로설계 기준 문서를 기반으로 질문에 답변합니다
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            새 대화
          </Button>
        )}
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center shadow-sm">
                <Route className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">무엇이 궁금하신가요?</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  도로설계 기준 문서에서 정확한 답변을 찾아드립니다
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-md">
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className={cn(
                    "text-left text-xs bg-background border border-border rounded-xl px-4 py-3.5",
                    "text-foreground hover:border-primary hover:text-primary hover:bg-accent",
                    "transition-all duration-150 shadow-sm leading-relaxed"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              // 로딩 중인 빈 assistant 말풍선은 로딩 점으로 대체
              if (msg.role === "assistant" && msg.content === "" && loading && i === messages.length - 1) return null
              return <MessageBubble key={i} message={msg} />
            })}

            {loading && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start mb-5">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="bg-background border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1.5 items-center h-4">
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 재생성 버튼 */}
      {canRegenerate && (
        <div className="px-6 pb-2 flex justify-center">
          <Button variant="outline" size="sm" onClick={regenerate}>
            <RotateCcw className="h-3 w-3 mr-1.5" />
            재생성
          </Button>
        </div>
      )}

      {/* 입력 영역 */}
      <footer className="px-6 py-4 bg-background border-t border-border flex-shrink-0">
        <div className="flex gap-2.5 items-end">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="도로설계 기준에 대해 질문하세요... (Enter 전송, Shift+Enter 줄바꿈)"
              className="min-h-[44px] pb-6 bg-secondary border-0 focus-visible:ring-1"
              rows={1}
              maxLength={500}
              disabled={loading}
            />
            <span className={cn(
              "absolute bottom-2 right-3 text-[11px] pointer-events-none",
              input.length >= 450 ? "text-orange-400" : "text-muted-foreground/50"
            )}>
              {input.length}/500
            </span>
          </div>
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="h-11 px-5 flex-shrink-0"
          >
            <Send className="h-4 w-4 mr-1.5" />
            전송
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          AI가 제공하는 정보는 참고용입니다. 중요 사항은 원문을 확인하세요.
        </p>
      </footer>
    </div>
  )
}
