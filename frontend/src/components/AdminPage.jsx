import { useState, useEffect, useRef } from "react"

const API_URL = import.meta.env.VITE_API_URL || ""

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [password, setPassword] = useState("")
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState("")
  const [tab, setTab] = useState("stats")

  // 통계
  const [stats, setStats] = useState(null)

  // PDF 업로드
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const fileRef = useRef(null)

  // 문서 목록
  const [documents, setDocuments] = useState([])
  const [deleteMsg, setDeleteMsg] = useState("")

  // DB 재구축
  const [rebuildMsg, setRebuildMsg] = useState("")
  const [rebuildRunning, setRebuildRunning] = useState(false)

  // 로그 조회
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [logs, setLogs] = useState([])
  const [sessionDates, setSessionDates] = useState([])

  const headers = { "X-Admin-Password": password, "Content-Type": "application/json" }

  const login = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, { headers })
      if (res.status === 401) { setAuthError("비밀번호가 틀렸습니다."); return }
      const data = await res.json()
      setStats(data)
      setAuthed(true)
      setAuthError("")
    } catch {
      setAuthError("서버에 연결할 수 없습니다.")
    }
  }

  const fetchStats = async () => {
    const res = await fetch(`${API_URL}/api/admin/stats`, { headers })
    setStats(await res.json())
  }

  const fetchSessions = async () => {
    const res = await fetch(`${API_URL}/api/admin/logs`, { headers })
    const data = await res.json()
    setSessions(data.sessions || [])
  }

  const fetchDocuments = async () => {
    const res = await fetch(`${API_URL}/api/documents`)
    const data = await res.json()
    setDocuments(data.documents || [])
  }

  const deleteDocument = async (filename) => {
    if (!window.confirm(`"${filename}"을 삭제하시겠습니까?\n벡터 DB에서도 제거됩니다.`)) return
    setDeleteMsg("")
    try {
      const res = await fetch(`${API_URL}/api/admin/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers,
      })
      const data = await res.json()
      setDeleteMsg(res.ok ? `✓ ${data.message}` : `✗ ${data.detail}`)
      if (res.ok) fetchDocuments()
    } catch {
      setDeleteMsg("✗ 삭제 실패")
    }
  }

  useEffect(() => {
    if (!authed) return
    if (tab === "stats") fetchStats()
    if (tab === "docs") fetchDocuments()
    if (tab === "logs") fetchSessions()
  }, [tab, authed])

  const uploadPDF = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadMsg("")
    const form = new FormData()
    form.append("file", file)
    try {
      const res = await fetch(`${API_URL}/api/admin/upload`, {
        method: "POST",
        headers: { "X-Admin-Password": password },
        body: form
      })
      const data = await res.json()
      setUploadMsg(res.ok ? `✓ ${data.message}` : `✗ ${data.detail}`)
    } catch {
      setUploadMsg("✗ 업로드 실패")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const startRebuild = async () => {
    setRebuildMsg("재구축 요청 중...")
    setRebuildRunning(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/rebuild`, { method: "POST", headers })
      const data = await res.json()
      if (!res.ok) { setRebuildMsg(`✗ ${data.detail}`); setRebuildRunning(false); return }
      setRebuildMsg("재구축 시작됨. 상태 확인 중...")
      const poll = setInterval(async () => {
        const r = await fetch(`${API_URL}/api/admin/rebuild/status`, { headers })
        const s = await r.json()
        setRebuildMsg(s.message)
        if (!s.running) { setRebuildRunning(false); clearInterval(poll) }
      }, 3000)
    } catch {
      setRebuildMsg("✗ 요청 실패")
      setRebuildRunning(false)
    }
  }

  const loadSessionDates = (sessionId) => {
    setSelectedSession(sessionId)
    setSelectedDate("")
    setLogs([])
    const session = sessions.find(s => s.session_id === sessionId)
    setSessionDates(session?.dates || [])
  }

  const loadLogs = async () => {
    if (!selectedSession || !selectedDate) return
    const res = await fetch(`${API_URL}/api/logs/${selectedSession}?date=${selectedDate}`)
    const data = await res.json()
    setLogs(data.logs || [])
  }

  // 로그인 화면
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-80">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Roadspec 관리자</h1>
          <p className="text-xs text-gray-400 mb-6">관리자 비밀번호를 입력하세요</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            placeholder="비밀번호"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 mb-3"
          />
          {authError && <p className="text-xs text-red-500 mb-3">{authError}</p>}
          <button
            onClick={login}
            className="w-full bg-blue-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            로그인
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "stats", label: "통계" },
    { id: "docs", label: "문서 관리" },
    { id: "logs", label: "대화 로그" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-900">Roadspec 관리자</h1>
          <p className="text-xs text-gray-400 mt-0.5">시스템 관리 및 모니터링</p>
        </div>
        <a href="/" className="text-xs text-gray-400 hover:text-gray-600">← 챗봇으로 돌아가기</a>
      </div>

      {/* 탭 */}
      <div className="px-8 pt-6">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 통계 탭 */}
        {tab === "stats" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="전체 질문 수" value={stats.total} sub="누적 총계" />
              <StatCard label="오늘 질문 수" value={stats.today} sub="오늘 기준" />
              <StatCard label="사용자 수" value={stats.sessions} sub="고유 세션" />
            </div>
            <button
              onClick={fetchStats}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              새로고침
            </button>
          </div>
        )}

        {/* 문서 관리 탭 */}
        {tab === "docs" && (
          <div className="space-y-6 max-w-lg">
            {/* PDF 업로드 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">PDF 업로드</h2>
              <p className="text-xs text-gray-400 mb-4">새 문서를 업로드하면 자동으로 인덱싱됩니다</p>
              <input ref={fileRef} type="file" accept=".pdf" onChange={uploadPDF} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-50"
              >
                {uploading ? "업로드 중..." : "📄 클릭하여 PDF 선택"}
              </button>
              {uploadMsg && (
                <p className={`text-xs mt-3 ${uploadMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {uploadMsg}
                </p>
              )}
            </div>

            {/* 문서 목록 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">등록된 문서</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{documents.length}개 문서</p>
                </div>
                <button onClick={fetchDocuments} className="text-xs text-gray-400 hover:text-gray-600">새로고침</button>
              </div>
              {documents.length > 0 ? (
                <ul className="space-y-2">
                  {documents.map(doc => (
                    <li key={doc} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-700 truncate">{doc}</span>
                      <button
                        onClick={() => deleteDocument(doc)}
                        className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 transition-colors"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">등록된 문서가 없습니다.</p>
              )}
              {deleteMsg && (
                <p className={`text-xs mt-3 ${deleteMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {deleteMsg}
                </p>
              )}
            </div>

            {/* DB 재구축 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">벡터 DB 재구축</h2>
              <p className="text-xs text-gray-400 mb-4">모든 문서를 다시 임베딩합니다. 수분 소요됩니다.</p>
              <button
                onClick={startRebuild}
                disabled={rebuildRunning}
                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {rebuildRunning ? "재구축 중..." : "재구축 시작"}
              </button>
              {rebuildMsg && (
                <p className="text-xs text-gray-500 mt-3">{rebuildMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* 대화 로그 탭 */}
        {tab === "logs" && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex gap-2">
              <select
                value={selectedSession}
                onChange={e => loadSessionDates(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">세션 선택...</option>
                {sessions.map(s => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.session_id} ({s.dates.length}일)
                  </option>
                ))}
              </select>
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                disabled={!sessionDates.length}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
              >
                <option value="">날짜 선택...</option>
                {sessionDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button
                onClick={loadLogs}
                disabled={!selectedSession || !selectedDate}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                조회
              </button>
            </div>

            {logs.length > 0 && (
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs text-gray-400 mb-2">{log.timestamp}</p>
                    <p className="text-sm font-medium text-gray-800">Q. {log.question}</p>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-3">A. {log.answer}</p>
                  </div>
                ))}
              </div>
            )}

            {logs.length === 0 && selectedDate && (
              <p className="text-sm text-gray-400">로그가 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
