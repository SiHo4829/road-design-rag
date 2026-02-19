import { useState, useEffect } from "react"
import Sidebar from "./components/Sidebar"
import ChatBox from "./components/ChatBox"
import AdminPage from "./components/AdminPage"
import { TooltipProvider } from "./components/ui/tooltip"

function App() {
  // ─── 다크 모드 ───────────────────────────────────────────
  const [dark, setDark] = useState(() => localStorage.getItem("roadspec_dark") === "1")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("roadspec_dark", dark ? "1" : "0")
  }, [dark])

  // ─── 멀티 세션 ───────────────────────────────────────────
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem("roadspec_sessions")
      if (saved) return JSON.parse(saved)
    } catch {}
    const id = localStorage.getItem("roadspec_session_id") || Math.random().toString(36).substring(2, 10)
    localStorage.setItem("roadspec_session_id", id)
    return [{ id, name: "대화 1", createdAt: Date.now() }]
  })

  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem("roadspec_session_id")
    return saved || sessions[0]?.id
  })

  useEffect(() => {
    localStorage.setItem("roadspec_sessions", JSON.stringify(sessions))
  }, [sessions])

  const createSession = () => {
    const id = Math.random().toString(36).substring(2, 10)
    const name = `대화 ${sessions.length + 1}`
    setSessions(prev => [...prev, { id, name, createdAt: Date.now() }])
    setActiveId(id)
    localStorage.setItem("roadspec_session_id", id)
  }

  const deleteSession = (id) => {
    localStorage.removeItem(`roadspec_messages_${id}`)
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (next.length === 0) {
        const newId = Math.random().toString(36).substring(2, 10)
        const newSession = { id: newId, name: "대화 1", createdAt: Date.now() }
        setActiveId(newId)
        localStorage.setItem("roadspec_session_id", newId)
        return [newSession]
      }
      if (id === activeId) {
        setActiveId(next[0].id)
        localStorage.setItem("roadspec_session_id", next[0].id)
      }
      return next
    })
  }

  // ─── 문서 필터 ───────────────────────────────────────────
  const [selectedSources, setSelectedSources] = useState([]) // 빈 배열 = 전체

  const toggleSource = (doc) => {
    setSelectedSources(prev => {
      if (prev.includes(doc)) {
        const next = prev.filter(d => d !== doc)
        return next
      }
      return [...prev, doc]
    })
  }

  // ─── 모바일 사이드바 ─────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (window.location.pathname === "/admin") {
    return <AdminPage />
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar
          sessions={sessions}
          activeId={activeId}
          onSelectSession={(id) => {
            setActiveId(id)
            localStorage.setItem("roadspec_session_id", id)
            setSidebarOpen(false)
          }}
          onCreateSession={createSession}
          onDeleteSession={deleteSession}
          selectedSources={selectedSources}
          onToggleSource={toggleSource}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {/* 모바일 오버레이 backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <ChatBox
          sessionId={activeId}
          selectedSources={selectedSources}
          dark={dark}
          onToggleDark={() => setDark(d => !d)}
          onMenuClick={() => setSidebarOpen(true)}
          onNewSession={createSession}
        />
      </div>
    </TooltipProvider>
  )
}

export default App
