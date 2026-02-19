import { useState, useEffect } from "react"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function Sidebar({ sessionId }) {
  const [documents, setDocuments] = useState([])
  const [logs, setLogs] = useState([])
  const [logDates, setLogDates] = useState([])
  const [selectedDate, setSelectedDate] = useState("")
  const [showLogs, setShowLogs] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    axios.get(`${API_URL}/api/documents`)
      .then(res => setDocuments(res.data.documents))
      .catch(err => console.error(err))
  }, [])

  useEffect(() => {
    axios.get(`${API_URL}/api/logs/${sessionId}/dates`)
      .then(res => {
        setLogDates(res.data.dates)
        if (res.data.dates.length > 0) setSelectedDate(res.data.dates[0])
      })
      .catch(err => console.error(err))
  }, [sessionId])

  const fetchLogs = () => {
    if (!selectedDate) return
    axios.get(`${API_URL}/api/logs/${sessionId}?date=${selectedDate}`)
      .then(res => { setLogs(res.data.logs); setShowLogs(true) })
      .catch(err => console.error(err))
  }

  if (collapsed) {
    return (
      <div className="w-12 h-screen bg-slate-800 flex flex-col items-center pt-4 gap-3 flex-shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-slate-400 hover:text-white transition-colors p-2"
          title="사이드바 열기"
        >
          ☰
        </button>
        <div className="text-slate-500 text-xs mt-2" style={{ writingMode: "vertical-rl" }}>
          Roadspec
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 h-screen bg-slate-800 flex flex-col flex-shrink-0">
      {/* 헤더 */}
      <div className="p-5 flex items-center justify-between border-b border-slate-700">
        <div>
          <h1 className="text-sm font-bold text-white">Roadspec</h1>
          <p className="text-xs text-slate-400 mt-0.5">도로설계 기준 문서 챗봇</p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
          title="사이드바 닫기"
        >
          ✕
        </button>
      </div>

      {/* 참조 문서 */}
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          참조 문서
        </h2>
        {documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map((doc, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-slate-500 flex-shrink-0 mt-0.5 text-xs">📄</span>
                <span className="text-xs text-slate-300 leading-relaxed">
                  {doc.replace(/\(.*?\)\.pdf$/, "").replace(/\.pdf$/, "")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">문서 없음</p>
        )}
      </div>

      {/* 대화 로그 */}
      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          대화 로그
        </h2>
        {logDates.length > 0 ? (
          <>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full text-xs bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 mb-2 focus:outline-none focus:border-slate-500"
            >
              {logDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
            <button
              onClick={fetchLogs}
              className="w-full text-xs bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 transition-colors font-medium"
            >
              로그 불러오기
            </button>

            {showLogs && (
              <div className="mt-3 space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs bg-slate-700 rounded-lg p-3 space-y-1.5">
                    <p className="text-slate-500">{log.timestamp}</p>
                    <p className="font-medium text-slate-200 line-clamp-2">Q: {log.question}</p>
                    <p className="text-slate-400 line-clamp-2">A: {log.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">저장된 로그가 없습니다.</p>
        )}
      </div>
    </div>
  )
}
