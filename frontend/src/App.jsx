import { useState } from "react"
import Sidebar from "./components/Sidebar"
import ChatBox from "./components/ChatBox"
import AdminPage from "./components/AdminPage"
import { TooltipProvider } from "./components/ui/tooltip"

function App() {
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem("roadspec_session_id")
    if (saved) return saved
    const newId = Math.random().toString(36).substring(2, 10)
    localStorage.setItem("roadspec_session_id", newId)
    return newId
  })

  if (window.location.pathname === "/admin") {
    return <AdminPage />
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar sessionId={sessionId} />
        <ChatBox sessionId={sessionId} />
      </div>
    </TooltipProvider>
  )
}

export default App
