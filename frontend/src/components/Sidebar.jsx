import { useState, useEffect } from "react"
import axios from "axios"

const API_URL = "http://localhost:8502"

export default function Sidebar({ sessionId }) {
  const [documents, setDocuments] = useState([])
  const [logs, setLogs] = useState([])
  const [logDates, setLogDates] = useState([])
  const [selectedDate, setSelectedDate] = useState("")
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    axios.get(`${API_URL}/api/documents`)
      .then(res => setDocuments(res.data.documents))
      .catch(err => console.error(err))
  }, [])

  useEffect(() => {
    axios.get(`${API_URL}/api/logs/${sessionId}/dates`)
      .then(res => {
        setLogDates(res.data.dates)
        if (res.data.dates.length > 0) {
          setSelectedDate(res.data.dates[0])
        }
      })
      .catch(err => console.error(err))
  }, [sessionId])

  const fetchLogs = () => {
    if (!selectedDate) return
    axios.get(`${API_URL}/api/logs/${sessionId}?date=${selectedDate}`)
      .then(res => {
        setLogs(res.data.logs)
        setShowLogs(true)
      })
      .catch(err => console.error(err))
  }

  return (
    <div className="w-72 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">🛣️ 도로설계 AI</h1>
        <p className="text-xs text-gray-500 mt-1">도로설계 기준 문서 기반 챗봇</p>
      </div>

      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">📚 참조 문서</h2>
        {documents.length > 0 ? (
          <ul className="space-y-1">
            {documents.map((doc, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                <span>📄</span>
                <span className="truncate">{doc}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">문서 없음</p>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">📋 대화 로그</h2>
        <p className="text-xs text-gray-400 mb-2">세션 ID: {sessionId}</p>

        {logDates.length > 0 ? (
          <>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded p-1 mb-2"
            >
              {logDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
            <button
              onClick={fetchLogs}
              className="w-full text-xs bg-blue-500 text-white rounded p-1 hover:bg-blue-600"
            >
              로그 보기
            </button>

            {showLogs && (
              <div className="mt-2 space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs bg-white border border-gray-200 rounded p-2">
                    <p className="text-gray-400">{log.timestamp}</p>
                    <p className="font-medium text-gray-700 mt-1">Q: {log.question}</p>
                    <p className="text-gray-500 mt-1 line-clamp-2">A: {log.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400">저장된 로그가 없습니다.</p>
        )}
      </div>
    </div>
  )
}