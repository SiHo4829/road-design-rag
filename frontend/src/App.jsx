import { useState } from "react"
import Sidebar from "./components/Sidebar"
import ChatBox from "./components/ChatBox"
import AdminPage from "./components/AdminPage"

function App() {
  const [sessionId] = useState(() =>
    Math.random().toString(36).substring(2, 10)
  )

  if (window.location.pathname === "/admin") {
    return <AdminPage />
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar sessionId={sessionId} />
      <ChatBox sessionId={sessionId} />
    </div>
  )
}

export default App