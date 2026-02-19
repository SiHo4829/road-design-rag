import { useState } from "react"
import Sidebar from "./components/Sidebar"
import ChatBox from "./components/ChatBox"
import AdminPage from "./components/AdminPage"
import { TooltipProvider } from "./components/ui/tooltip"

function App() {
  const [sessionId] = useState(() =>
    Math.random().toString(36).substring(2, 10)
  )

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
