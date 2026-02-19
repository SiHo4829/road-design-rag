import { useState, useRef, useEffect } from "react"
import axios from "axios"
import MessageBubble from "./MessageBubble"

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

  const sendMessage = async (question) => {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput("")

    setMessages(prev => [...prev, { role: "user", content: q }])
    setLoading(true)

    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        question: q,
        session_id: sessionId
      })
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.data.answer,
        sources: res.data.sources
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "오류가 발생했습니다. 다시 시도해주세요.",
        sources: []
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50 min-w-0">
      {/* 헤더 */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">도로설계 기준 AI 챗봇</h2>
        <p className="text-xs text-gray-400 mt-0.5">도로설계 기준 문서를 기반으로 질문에 답변합니다</p>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <p className="text-3xl mb-3">🛣️</p>
              <p className="text-base font-medium text-gray-600">무엇이 궁금하신가요?</p>
              <p className="text-sm text-gray-400 mt-1">도로설계 기준 문서에서 정확한 답변을 찾아드립니다</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {loading && (
              <div className="flex justify-start mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    AI
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div className="px-6 py-4 bg-white border-t border-gray-200">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="도로설계 기준에 대해 질문하세요... (Enter 전송, Shift+Enter 줄바꿈)"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-gray-50"
            rows={1}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors flex-shrink-0"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
