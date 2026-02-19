import { useState, useEffect, useRef } from "react"
import axios from "axios"
import {
  Route, BookOpen, FileText, MessageSquare,
  PanelLeftClose, PanelLeftOpen, Plus, X, Check
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
  onRenameSession,
  selectedSources,
  onSetSources,
  open,
  onClose,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [documents, setDocuments] = useState([])

  // 세션 이름 인라인 편집
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState("")
  const editInputRef = useRef(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    axios.get(`${API_URL}/api/documents`)
      .then(res => setDocuments(res.data.documents || []))
      .catch(() => {})
  }, [])

  // 체크박스 토글 (버그 수정: onSetSources로 한 번에 처리)
  const handleToggle = (doc) => {
    if (selectedSources.length === 0) {
      // 전체 선택 상태 → 해당 문서만 제외
      onSetSources(documents.filter(d => d !== doc))
    } else if (selectedSources.includes(doc)) {
      // 해제
      const next = selectedSources.filter(d => d !== doc)
      onSetSources(next)
    } else {
      // 추가 (모두 선택되면 전체 선택 상태로)
      const next = [...selectedSources, doc]
      onSetSources(next.length === documents.length ? [] : next)
    }
  }

  const isChecked = (doc) => selectedSources.length === 0 || selectedSources.includes(doc)

  const startEdit = (session) => {
    setEditingId(session.id)
    setEditName(session.name)
  }

  const commitEdit = () => {
    if (editingId && editName.trim()) {
      onRenameSession(editingId, editName.trim())
    }
    setEditingId(null)
  }

  if (collapsed) {
    return (
      <div className="w-12 h-screen flex-shrink-0 flex-col items-center pt-3 gap-2 bg-[hsl(var(--sidebar-bg))] border-r border-border hidden md:flex">
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
    <div className={cn(
      "w-64 h-screen flex-col bg-[hsl(var(--sidebar-bg))] border-r border-border",
      "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
      open ? "translate-x-0" : "-translate-x-full",
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
          <Button
            variant="ghost" size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground h-7 w-7 md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">참조 문서</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{documents.length}</Badge>
            {selectedSources.length > 0 && (
              <button onClick={() => onSetSources([])} className="text-[10px] text-primary hover:underline">
                전체 선택
              </button>
            )}
          </div>
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">문서 없음</p>
        ) : (
          <ScrollArea className="h-[150px]">
            <ul className="space-y-0.5 pr-2">
              {documents.map((doc, i) => (
                <li key={i} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    id={`doc-${i}`}
                    checked={isChecked(doc)}
                    onChange={() => handleToggle(doc)}
                    className="h-3 w-3 rounded border-border accent-primary flex-shrink-0 cursor-pointer"
                  />
                  <label htmlFor={`doc-${i}`} className="flex items-center gap-1.5 cursor-pointer min-w-0">
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
      </div>

      <Separator />

      {/* 세션 목록 */}
      <div className="px-4 py-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">대화 목록</span>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={onCreateSession}
            title="새 대화"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-0.5 pr-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors duration-100",
                  session.id === activeId
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent text-foreground"
                )}
                onClick={() => {
                  if (editingId !== session.id) onSelectSession(session.id)
                }}
              >
                <MessageSquare className={cn(
                  "h-3 w-3 flex-shrink-0",
                  session.id === activeId ? "text-primary" : "text-muted-foreground"
                )} />

                {editingId === session.id ? (
                  // 인라인 편집 입력창
                  <input
                    ref={editInputRef}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitEdit()
                      if (e.key === "Escape") setEditingId(null)
                      e.stopPropagation()
                    }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 text-xs bg-background border border-ring rounded px-1 py-0.5 outline-none text-foreground"
                    maxLength={30}
                  />
                ) : (
                  <span
                    className="text-xs flex-1 truncate"
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(session) }}
                    title="더블클릭하여 이름 변경"
                  >
                    {session.name}
                  </span>
                )}

                {editingId === session.id ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); commitEdit() }}
                    className="text-primary hover:text-primary/80"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                ) : (
                  sessions.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id) }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
