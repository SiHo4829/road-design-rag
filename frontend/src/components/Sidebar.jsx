import { useState, useEffect } from "react"
import axios from "axios"
import {
  Route, BookOpen, FileText, MessageSquare,
  PanelLeftClose, PanelLeftOpen, Plus, X
} from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Separator } from "./ui/separator"
import { ScrollArea } from "./ui/scroll-area"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function Sidebar({
  sessions,
  activeId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  selectedSources,
  onToggleSource,
  open,
  onClose,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [documents, setDocuments] = useState([])

  useEffect(() => {
    axios.get(`${API_URL}/api/documents`)
      .then(res => setDocuments(res.data.documents || []))
      .catch(() => {})
  }, [])

  // 문서 체크박스: selectedSources가 비어있으면 전체 체크
  const isChecked = (doc) => selectedSources.length === 0 || selectedSources.includes(doc)

  const handleToggle = (doc) => {
    if (selectedSources.length === 0) {
      // 전체 선택 상태에서 하나 해제 → 나머지 전부 선택
      onToggleSource(doc) // toggleSource는 빈 배열이면 추가하지 않음
      // 대신: 나머지 문서들을 모두 selectedSources에 추가
      const others = documents.filter(d => d !== doc)
      // App.jsx의 toggleSource는 하나씩만 처리 → 직접 배열 전달하는 대신
      // 아래처럼: 먼저 모든 문서를 선택한 뒤 해당 문서를 제거
      // → App.jsx onToggleSource 대신 onSetSources prop을 쓰거나
      //    여기서는 단순히 doc만 토글 (App에서 처리)
      others.forEach(d => {
        if (!selectedSources.includes(d)) onToggleSource(d)
      })
    } else {
      onToggleSource(doc)
    }
  }

  const collapsedContent = (
    <div className={cn(
      "w-12 h-screen flex-shrink-0 flex flex-col items-center pt-3 gap-2",
      "bg-[hsl(var(--sidebar-bg))] border-r border-border",
      "hidden md:flex"
    )}>
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

  if (collapsed) return collapsedContent

  return (
    <>
      <div className={cn(
        "w-64 h-screen flex-col bg-[hsl(var(--sidebar-bg))] border-r border-border flex-shrink-0",
        // 모바일: fixed overlay
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full",
        // 데스크탑: 항상 표시
        "md:relative md:translate-x-0 md:flex"
      )}>
        {/* 헤더 */}
        <div className="px-4 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Route className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">Roadspec</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">도로설계 기준 챗봇</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* 모바일 닫기 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground h-7 w-7 md:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
            {/* 데스크탑 축소 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground hover:text-foreground h-7 w-7 hidden md:flex"
              title="사이드바 닫기"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* 참조 문서 + 필터 */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                참조 문서
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 min-w-0">
                {documents.length}
              </Badge>
              {selectedSources.length > 0 && (
                <Badge variant="blue" className="text-[10px] h-4 px-1.5 min-w-0">
                  {selectedSources.length}개 선택
                </Badge>
              )}
            </div>
          </div>

          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">문서 없음</p>
          ) : (
            <ScrollArea className="h-[160px]">
              <ul className="space-y-0.5 pr-2">
                {documents.map((doc, i) => (
                  <li key={i} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id={`doc-${i}`}
                      checked={isChecked(doc)}
                      onChange={() => handleToggle(doc)}
                      className="h-3 w-3 rounded border-border accent-primary flex-shrink-0 cursor-pointer"
                    />
                    <label
                      htmlFor={`doc-${i}`}
                      className="flex items-center gap-1.5 cursor-pointer min-w-0"
                    >
                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-foreground leading-snug line-clamp-2">
                        {doc.replace(/\(.*?\)\.pdf$/i, "").replace(/\.pdf$/i, "").trim()}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          {selectedSources.length > 0 && (
            <button
              onClick={() => documents.forEach(d => {
                if (selectedSources.includes(d)) onToggleSource(d)
              })}
              className="mt-1.5 text-[11px] text-primary hover:underline"
            >
              전체 선택 해제
            </button>
          )}
        </div>

        <Separator />

        {/* 세션 목록 */}
        <div className="px-4 py-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                대화 목록
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={onCreateSession}
              title="새 대화"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer",
                    "transition-colors duration-100",
                    session.id === activeId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent text-foreground"
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <MessageSquare className={cn(
                    "h-3 w-3 flex-shrink-0",
                    session.id === activeId ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-xs flex-1 truncate">{session.name}</span>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id) }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  )
}
