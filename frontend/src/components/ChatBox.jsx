import { useState, useRef, useEffect } from "react"
import axios from "axios"
import MessageBubble from "./MessageBubble"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function ChatBox({ sessionId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput("")

    setMessages(prev => [...prev, {
      role: "user",
      content: question
    }])

    setLoading(true)

    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        question,
        session_id: sessionId
      })

      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.data.answer,
        sources: res.data.sources
      }])

    } catch (err) {
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
    <div className="flex-1 flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800">🛣️ 도로설계 기준 AI 챗봇</h2>
        <p className="text-xs text-gray-500">도로설계 기준 문서를 기반으로 질문에 답변합니다.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-4xl mb-4">🛣️</p>
            <p className="text-lg font-medium">도로설계 기준에 대해 질문하세요</p>
            <p className="text-sm mt-1">예: 설계속도란 무엇인가요?</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
                🤖
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0ms"}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "150ms"}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="도로설계 기준에 대해 질문하세요... (Enter로 전송)"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400"
            rows={1}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}