import { useState, useEffect, useRef } from "react"
import {
  Route, MessageSquare, TrendingUp, Users, Upload, FileText,
  Trash2, RefreshCw, Loader2, LogIn, AlertCircle, ArrowLeft, RotateCcw,
  ThumbsUp, ThumbsDown, Zap, ShieldAlert
} from "lucide-react"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""

function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        {Icon && (
          <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-foreground tabular-nums">{value ?? "-"}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [password, setPassword] = useState("")
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState("")
  const [tab, setTab] = useState("stats")

  const [stats, setStats] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const fileRef = useRef(null)

  const [documents, setDocuments] = useState([])
  const [deleteMsg, setDeleteMsg] = useState("")

  const [rebuildMsg, setRebuildMsg] = useState("")
  const [rebuildRunning, setRebuildRunning] = useState(false)

  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [logs, setLogs] = useState([])
  const [sessionDates, setSessionDates] = useState([])

  const [feedbackStats, setFeedbackStats] = useState(null)
  const [feedbacks, setFeedbacks] = useState([])

  const [errors, setErrors] = useState([])
  const [errorTotal, setErrorTotal] = useState(0)

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

  const fetchFeedback = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/feedback`, { headers })
      const data = await res.json()
      setFeedbackStats(data.stats)
      setFeedbacks(data.feedbacks || [])
    } catch {}
  }

  const fetchErrors = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/errors`, { headers })
      const data = await res.json()
      setErrors(data.errors || [])
      setErrorTotal(data.total || 0)
    } catch {}
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
        method: "DELETE", headers,
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
    if (tab === "feedback") fetchFeedback()
    if (tab === "errors") fetchErrors()
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
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 w-[360px]">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Route className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Roadspec</h1>
              <p className="text-xs text-muted-foreground">관리자 대시보드</p>
            </div>
          </div>
          <Separator className="mb-5" />
          <p className="text-xs text-muted-foreground mb-3">관리자 비밀번호를 입력하세요</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            placeholder="비밀번호"
            className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3"
          />
          {authError && (
            <p className="text-xs text-destructive mb-3 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {authError}
            </p>
          )}
          <Button className="w-full" onClick={login}>
            <LogIn className="h-4 w-4 mr-2" />
            로그인
          </Button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "stats", label: "통계" },
    { id: "docs", label: "문서 관리" },
    { id: "logs", label: "대화 로그" },
    { id: "feedback", label: "피드백" },
    { id: "errors", label: "오류 로그" },
  ]

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 헤더 */}
      <header className="bg-background border-b border-border px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <Route className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Roadspec 관리자</h1>
            <p className="text-[11px] text-muted-foreground">시스템 관리 및 모니터링</p>
          </div>
        </div>
        <a
          href="/"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          챗봇으로 돌아가기
        </a>
      </header>

      <div className="px-8 pt-6">
        {/* 탭 */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 통계 탭 */}
        {tab === "stats" && stats && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
              <StatCard label="전체 질문 수" value={stats.total} sub="누적 총계" icon={MessageSquare} />
              <StatCard label="오늘 질문 수" value={stats.today} sub="오늘 기준" icon={TrendingUp} />
              <StatCard label="사용자 수" value={stats.sessions} sub="고유 세션" icon={Users} />
              <StatCard
                label="캐시 히트"
                value={stats.cache_hits ?? 0}
                sub={stats.total > 0 ? `${Math.round((stats.cache_hits ?? 0) / (stats.total + (stats.cache_hits ?? 0)) * 100)}% 히트율` : "캐시 미사용"}
                icon={Zap}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={fetchStats} className="text-muted-foreground">
              <RotateCcw className="h-3 w-3 mr-1.5" />
              새로고침
            </Button>
          </div>
        )}

        {/* 문서 관리 탭 */}
        {tab === "docs" && (
          <div className="space-y-5 max-w-lg">
            {/* PDF 업로드 */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-1">PDF 업로드</h2>
              <p className="text-xs text-muted-foreground mb-4">새 문서를 업로드하면 자동으로 인덱싱됩니다</p>
              <input ref={fileRef} type="file" accept=".pdf" onChange={uploadPDF} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "w-full border-2 border-dashed border-border rounded-xl py-7",
                  "flex flex-col items-center gap-2.5",
                  "text-sm text-muted-foreground",
                  "hover:border-primary hover:bg-accent hover:text-primary",
                  "transition-all duration-150 disabled:opacity-50"
                )}
              >
                <Upload className="h-5 w-5" />
                {uploading ? "업로드 중..." : "클릭하여 PDF 선택"}
              </button>
              {uploadMsg && (
                <p className={cn(
                  "text-xs mt-3",
                  uploadMsg.startsWith("✓") ? "text-green-600" : "text-destructive"
                )}>
                  {uploadMsg}
                </p>
              )}
            </div>

            {/* 문서 목록 */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">등록된 문서</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{documents.length}개 문서</p>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchDocuments} className="text-muted-foreground h-7">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  새로고침
                </Button>
              </div>
              {documents.length > 0 ? (
                <ul>
                  {documents.map(doc => (
                    <li key={doc} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-xs text-foreground truncate">{doc}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteDocument(doc)}
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">등록된 문서가 없습니다.</p>
              )}
              {deleteMsg && (
                <p className={cn(
                  "text-xs mt-3",
                  deleteMsg.startsWith("✓") ? "text-green-600" : "text-destructive"
                )}>
                  {deleteMsg}
                </p>
              )}
            </div>

            {/* DB 재구축 */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-1">벡터 DB 재구축</h2>
              <p className="text-xs text-muted-foreground mb-4">모든 문서를 다시 임베딩합니다. 수분 소요됩니다.</p>
              <Button variant="destructive" onClick={startRebuild} disabled={rebuildRunning}>
                {rebuildRunning
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />재구축 중...</>
                  : <><RefreshCw className="h-4 w-4 mr-2" />재구축 시작</>
                }
              </Button>
              {rebuildMsg && (
                <p className="text-xs text-muted-foreground mt-3">{rebuildMsg}</p>
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
                className="flex-1 border border-input rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="border border-input rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">날짜 선택...</option>
                {sessionDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <Button
                onClick={loadLogs}
                disabled={!selectedSession || !selectedDate}
              >
                조회
              </Button>
            </div>

            {logs.length > 0 && (
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <p className="text-[11px] text-muted-foreground mb-2">{log.timestamp}</p>
                    <p className="text-sm font-medium text-foreground">Q. {log.question}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">A. {log.answer}</p>
                  </div>
                ))}
              </div>
            )}

            {logs.length === 0 && selectedDate && (
              <p className="text-sm text-muted-foreground">로그가 없습니다.</p>
            )}
          </div>
        )}

        {/* 오류 로그 탭 */}
        {tab === "errors" && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <p className="text-sm font-semibold text-foreground">
                  오류 로그
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (총 {errorTotal}건, 최근 100건 표시)
                  </span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchErrors} className="text-muted-foreground h-7">
                <RotateCcw className="h-3 w-3 mr-1" />
                새로고침
              </Button>
            </div>

            {errors.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
                <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">기록된 오류가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {errors.map((err, i) => (
                  <div key={i} className="bg-card rounded-xl border border-destructive/30 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        {err.error_type || "Error"}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">{err.timestamp}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">질문:</span> {err.question}
                    </p>
                    <p className="text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2 font-mono break-all">
                      {err.error}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">세션: {err.session_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 피드백 탭 */}
        {tab === "feedback" && (
          <div className="space-y-5 max-w-2xl">
            {/* 통계 카드 */}
            {feedbackStats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
                  <p className="text-xs text-muted-foreground mb-1">전체</p>
                  <p className="text-2xl font-bold text-foreground">{feedbackStats.total}</p>
                </div>
                <div className="bg-card rounded-xl border border-green-200 dark:border-green-900 p-4 shadow-sm text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <ThumbsUp className="h-3 w-3 text-green-500" />
                    <p className="text-xs text-muted-foreground">긍정</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{feedbackStats.positive}</p>
                  {feedbackStats.total > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {Math.round(feedbackStats.positive / feedbackStats.total * 100)}%
                    </p>
                  )}
                </div>
                <div className="bg-card rounded-xl border border-red-200 dark:border-red-900 p-4 shadow-sm text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <ThumbsDown className="h-3 w-3 text-red-500" />
                    <p className="text-xs text-muted-foreground">부정</p>
                  </div>
                  <p className="text-2xl font-bold text-red-500">{feedbackStats.negative}</p>
                  {feedbackStats.total > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {Math.round(feedbackStats.negative / feedbackStats.total * 100)}%
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">최근 피드백 (최대 50건)</p>
              <Button variant="ghost" size="sm" onClick={fetchFeedback} className="text-muted-foreground h-7">
                <RotateCcw className="h-3 w-3 mr-1" />
                새로고침
              </Button>
            </div>

            {feedbacks.length > 0 ? (
              <div className="space-y-2">
                {feedbacks.map((fb, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground flex-1 leading-snug">{fb.question}</p>
                      <div className={cn(
                        "flex items-center gap-1 flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                        fb.rating === 1
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                          : "bg-red-100 dark:bg-red-900/30 text-red-500"
                      )}>
                        {fb.rating === 1
                          ? <><ThumbsUp className="h-3 w-3" />좋아요</>
                          : <><ThumbsDown className="h-3 w-3" />별로</>
                        }
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{fb.timestamp?.slice(0, 16).replace("T", " ")}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">피드백 데이터가 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
