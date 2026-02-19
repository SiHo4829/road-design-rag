import { useState, useRef, useEffect, useCallback } from "react"
import {
  Route, MessageSquare, Send, RotateCcw, Plus, Bot,
  Moon, Sun, Download, Square, Menu, Search, X, ChevronDown
} from "lucide-react"
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

export default function ChatBox({
  sessionId, selectedSources, dark, onToggleDark,
  onMenuClick, onRenameSession,
}) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(`roadspec_messages_${sessionId}`)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)

  // 검색
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef(null)

  const bottomRef = useRef(null)
  const abortRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const sessionNamedRef = useRef(false) // 세션 이름 자동 설정 여부

  // 세션 변경 시 메시지 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`roadspec_messages_${sessionId}`)
      setMessages(saved ? JSON.parse(saved) : [])
    } catch { setMessages([]) }
    sessionNamedRef.current = false
    setSearchQuery("")
    setSearchOpen(false)
  }, [sessionId])

  useEffect(() => {
    if (!showScrollDown) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  useEffect(() => {
    try {
      localStorage.setItem(`roadspec_messages_${sessionId}`, JSON.stringify(messages))
    } catch {}
  }, [messages, sessionId])

  // 검색창 열릴 때 포커스
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  // 스크롤 감지
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distFromBottom > 150)
  }, [])

  const sendMessage = async (question, overrideHistory) => {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput("")

    const history = overrideHistory ?? messages.map(m => ({ role: m.role, content: m.content }))

    if (overrideHistory === undefined) {
      setMessages(prev => [...prev, { role: "user", content: q }])
      // 세션 이름 자동 설정 (첫 메시지)
      if (!sessionNamedRef.current && messages.length === 0) {
        sessionNamedRef.current = true
        onRenameSession?.(sessionId, q.slice(0, 18))
      }
    }
    setMessages(prev => [...prev, { role: "assistant", content: "", sources: [] }])
    setLoading(true)

    abortRef.current = new AbortController()

    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          session_id: sessionId,
          history,
          selected_sources: selectedSources,
        }),
        signal: abortRef.current.signal,
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
            } else if (parsed.type === "cache_hit") {
              setMessages(prev => {
                const msgs = [...prev]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], fromCache: true }
                return msgs
              })
            } else if (parsed.type === "related_questions") {
              setMessages(prev => {
                const msgs = [...prev]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], relatedQuestions: parsed.questions }
                return msgs
              })
            } else if (parsed.type === "error") {
              setMessages(prev => {
                const msgs = [...prev]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "오류가 발생했습니다.", isError: true }
                return msgs
              })
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name === "AbortError") {
        setMessages(prev => {
          const msgs = [...prev]
          const last = msgs[msgs.length - 1]
          if (last?.role === "assistant" && !last.content) {
            msgs[msgs.length - 1] = { ...last, content: "_(중단됨)_" }
          }
          return msgs
        })
        return
      }
      setMessages(prev => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "오류가 발생했습니다. 다시 시도해주세요.", isError: true }
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

  const exportChat = () => {
    const date = new Date().toISOString().slice(0, 10)
    const md = `# Roadspec 대화 기록 (${date})\n\n` +
      messages.map(m =>
        m.role === "user"
          ? `**사용자:** ${m.content}`
          : `**Roadspec:** ${m.content}${m.sources?.length ? `\n\n> 출처: ${m.sources.map(s => `${s.filename} p.${s.page}`).join(", ")}` : ""}`
      ).join("\n\n---\n\n")
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `roadspec_${date}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const lastMsg = messages[messages.length - 1]
  const canRegenerate = !loading && lastMsg?.role === "assistant" && !!lastMsg?.content && !lastMsg?.isError
  const canRetry = !loading && lastMsg?.role === "assistant" && !!lastMsg?.isError

  // 검색 필터
  const searchLower = searchQuery.trim().toLowerCase()
  const matchingIds = searchLower
    ? new Set(messages.map((_, i) => i).filter(i => messages[i].content.toLowerCase().includes(searchLower)))
    : null

  return (
    <div className="flex-1 flex flex-col h-screen bg-background min-w-0 relative">
      {/* 헤더 */}
      <header className="px-4 md:px-6 py-3.5 bg-background border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden text-muted-foreground" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
          <MessageSquare className="h-4 w-4 text-primary hidden md:block" />
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">Roadspec</h2>
            <p className="text-[11px] text-muted-foreground leading-tight hidden md:block">
              도로설계 기준 문서를 기반으로 질문에 답변합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* 검색 */}
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSearchOpen(v => !v)} title="대화 검색">
              <Search className="h-4 w-4" />
            </Button>
          )}
          {/* 다크 모드 */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleDark}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {/* 내보내기 */}
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportChat} title="대화 내보내기">
              <Download className="h-4 w-4" />
            </Button>
          )}
          {/* 새 대화 (현재 세션 초기화) */}
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => {
              setMessages([])
              localStorage.removeItem(`roadspec_messages_${sessionId}`)
              sessionNamedRef.current = false
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              새 대화
            </Button>
          )}
        </div>
      </header>

      {/* 검색 바 */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border bg-background flex items-center gap-2 flex-shrink-0">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Escape" && (setSearchOpen(false), setSearchQuery(""))}
            placeholder="대화 내 검색..."
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <span className="text-[11px] text-muted-foreground flex-shrink-0">
              {matchingIds?.size ?? 0}개 결과
            </span>
          )}
          <button onClick={() => { setSearchOpen(false); setSearchQuery("") }} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 메시지 영역 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-6"
      >
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
              if (msg.role === "assistant" && msg.content === "" && loading && i === messages.length - 1) return null
              const prevQuestion = msg.role === "assistant"
                ? messages.slice(0, i).reverse().find(m => m.role === "user")?.content ?? ""
                : ""
              const highlighted = matchingIds ? matchingIds.has(i) : false
              return (
                <MessageBubble
                  key={i}
                  message={msg}
                  sessionId={sessionId}
                  prevQuestion={prevQuestion}
                  onRelatedClick={(q) => sendMessage(q)}
                  highlighted={highlighted}
                  searchQuery={searchLower}
                />
              )
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

      {/* 스크롤 다운 버튼 */}
      {showScrollDown && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" })
            setShowScrollDown(false)
          }}
          className={cn(
            "absolute bottom-28 right-6 z-10",
            "h-8 w-8 rounded-full bg-primary text-white shadow-lg",
            "flex items-center justify-center",
            "hover:bg-primary/90 transition-all"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}

      {/* 재생성 / 중단 / 재시도 버튼 */}
      {(canRegenerate || loading || canRetry) && (
        <div className="px-6 pb-2 flex justify-center gap-2">
          {loading && (
            <Button variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
              <Square className="h-3 w-3 mr-1.5" />
              중단
            </Button>
          )}
          {canRegenerate && (
            <Button variant="outline" size="sm" onClick={regenerate}>
              <RotateCcw className="h-3 w-3 mr-1.5" />
              재생성
            </Button>
          )}
          {canRetry && (
            <Button variant="outline" size="sm" onClick={regenerate}>
              <RotateCcw className="h-3 w-3 mr-1.5" />
              다시 시도
            </Button>
          )}
        </div>
      )}

      {/* 입력 영역 */}
      <footer className="px-4 md:px-6 py-4 bg-background border-t border-border flex-shrink-0">
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
