import { useState } from "react"
import Sidebar from "./components/Sidebar"
import ChatBox from "./components/ChatBox"

function App() {
  const [sessionId] = useState(() => 
    Math.random().toString(36).substring(2, 10)
  )

  return (
    <div className="flex h-screen bg-white">
      <Sidebar sessionId={sessionId} />
      <ChatBox sessionId={sessionId} />
    </div>
  )
}

export default App