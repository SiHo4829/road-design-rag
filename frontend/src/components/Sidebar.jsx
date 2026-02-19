import { useState, useEffect } from "react"
import axios from "axios"
import {
  Route, BookOpen, FileText, Clock,
  PanelLeftClose, PanelLeftOpen, RotateCcw
} from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Separator } from "./ui/separator"
import { ScrollArea } from "./ui/scroll-area"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function Sidebar({ sessionId }) {
  const [collapsed, setCollapsed] = useState(false)
  const [documents, setDocuments] = useState([])
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState("")
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    axios.get(`${API_URL}/api/documents`)
      .then(res => setDocuments(res.data.documents || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!sessionId) return
    axios.get(`${API_URL}/api/logs/${sessionId}/dates`)
      .then(res => {
        const d = res.data.dates || []
        setDates(d)
        if (d.length > 0) setSelectedDate(d[0])
      })
      .catch(() => {})
  }, [sessionId])

  const fetchLogs = () => {
    if (!selectedDate) return
    axios.get(`${API_URL}/api/logs/${sessionId}?date=${selectedDate}`)
      .then(res => {
        setLogs(res.data.logs || [])
        setShowLogs(true)
      })
      .catch(() => {})
  }

  if (collapsed) {
    return (
      <div className="w-12 h-screen flex-shrink-0 flex flex-col items-center pt-3 gap-2 bg-[hsl(var(--sidebar-bg))] border-r border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="text-muted-foreground hover:text-foreground"
          title="사이드바 열기"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Roadspec
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 h-screen flex-shrink-0 flex flex-col bg-[hsl(var(--sidebar-bg))] border-r border-border">
      {/* 헤더 */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Route className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">Roadspec</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">도로설계 기준 챗봇</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="text-muted-foreground hover:text-foreground h-7 w-7"
          title="사이드바 닫기"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* 참조 문서 */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              참조 문서
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 min-w-0">
            {documents.length}
          </Badge>
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">문서 없음</p>
        ) : (
          <ScrollArea className="h-[180px]">
            <ul className="space-y-1 pr-2">
              {documents.map((doc, i) => (
                <li key={i} className="flex items-start gap-2 py-1">
                  <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-foreground leading-snug line-clamp-2">
                    {doc.replace(/\(.*?\)\.pdf$/i, "").replace(/\.pdf$/i, "").trim()}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>

      <Separator />

      {/* 대화 로그 */}
      <div className="px-4 py-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            대화 로그
          </span>
        </div>

        {dates.length > 0 ? (
          <>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className={cn(
                "w-full text-xs border border-input bg-background text-foreground",
                "rounded-lg px-3 py-1.5 mb-2",
                "focus:outline-none focus:ring-2 focus:ring-ring"
              )}
            >
              {dates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              className="w-full mb-3 text-xs h-7"
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              로그 불러오기
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground mb-3">로그 없음</p>
        )}

        {showLogs && logs.length > 0 && (
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-2">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3 space-y-1.5 shadow-sm"
                >
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {log.timestamp}
                  </p>
                  <p className="text-xs font-medium text-foreground line-clamp-2">
                    {log.question}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {log.answer}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
