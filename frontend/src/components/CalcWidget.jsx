import { useState } from "react"
import { Download, RefreshCw, ChevronRight, ShieldCheck, BookmarkPlus, BarChart2, X } from "lucide-react"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""
const ALT_LABELS = ["대안 A", "대안 B", "대안 C"]

const STEPS = [
  {
    key: "road_grade",
    label: "도로 등급",
    question: "도로 등급을 선택하세요",
    options: ["고속도로", "일반국도", "지방도", "시군도"],
  },
  {
    key: "design_speed",
    label: "설계속도",
    question: "설계속도를 선택하세요 (km/h)",
    optionsByGrade: {
      고속도로:  [80, 100, 120],
      일반국도: [60, 80, 100],
      지방도:   [40, 60, 80],
      시군도:   [40, 60],
    },
  },
  {
    key: "terrain",
    label: "지형 조건",
    question: "지형 조건을 선택하세요",
    options: ["평지", "구릉지", "산지"],
  },
  {
    key: "region",
    label: "지역 조건",
    question: "지역 조건을 선택하세요",
    options: ["지방지역", "도시지역"],
  },
  {
    key: "lane_count",
    label: "차로 수",
    question: "차로 수를 선택하세요",
    options: [2, 4, 6, 8],
  },
]

const CATEGORY_COLOR = {
  횡단: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  선형: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  종단: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300",
  시거: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
}

export default function CalcWidget() {
  const [step, setStep] = useState(0)
  const [inputs, setInputs] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ── 검증 상태 ──
  const [showValidation, setShowValidation] = useState(false)
  const [designValues, setDesignValues] = useState({})
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState(null)

  // ── 대안 비교 상태 ──
  const [savedAlts, setSavedAlts] = useState([])
  const [compareMode, setCompareMode] = useState(false)

  const currentStep = STEPS[step]

  const getOptions = (s) => {
    if (s.key === "design_speed") {
      return (s.optionsByGrade?.[inputs.road_grade] ?? [])
    }
    return s.options ?? []
  }

  const handleSelect = async (value) => {
    const newInputs = { ...inputs, [currentStep.key]: value }
    setInputs(newInputs)

    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }

    // 마지막 스텝 완료 → 계산 요청
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          road_grade:   newInputs.road_grade,
          design_speed: Number(newInputs.design_speed),
          terrain:      newInputs.terrain,
          region:       newInputs.region,
          lane_count:   Number(newInputs.lane_count),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "계산 오류")
      }
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep(0)
    setInputs({})
    setResult(null)
    setError(null)
    setShowValidation(false)
    setDesignValues({})
    setValidation(null)
    // savedAlts, compareMode 유지 (대안 비교는 유지)
  }

  const handleExcel = () => {
    if (!result) return
    const { road_grade, design_speed, terrain, region, lane_count } = result.inputs
    const params = new URLSearchParams({
      road_grade, design_speed, terrain, region, lane_count,
    })
    window.open(`${API_URL}/api/calc/excel?${params}`, "_blank")
  }

  // ── 검증 헬퍼 ────────────────────────────────────────────────────────────
  const getLimitLabel = (name) => {
    if (["최대 편경사", "최대 종단경사"].includes(name)) return "≤"
    if (["노면 횡단경사", "길어깨 횡단경사"].includes(name)) return "="
    return "≥"
  }

  const handleValidate = async () => {
    setValidating(true)
    try {
      const parsed = {}
      for (const [k, v] of Object.entries(designValues)) {
        const n = parseFloat(v)
        if (!isNaN(n)) parsed[k] = n
      }
      const res = await fetch(`${API_URL}/api/calc/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.inputs, design_values: parsed }),
      })
      if (res.ok) setValidation(await res.json())
    } finally {
      setValidating(false)
    }
  }

  // ── 대안 저장/삭제 ───────────────────────────────────────────────────────
  const handleSaveAlt = () => {
    if (!result || savedAlts.length >= 3) return
    const alreadySaved = savedAlts.some(
      a => JSON.stringify(a.inputs) === JSON.stringify(result.inputs)
    )
    if (alreadySaved) return
    setSavedAlts(prev => [
      ...prev,
      { label: ALT_LABELS[prev.length], inputs: result.inputs, result },
    ])
  }

  const handleRemoveAlt = (idx) => {
    setSavedAlts(prev => {
      const next = prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, label: ALT_LABELS[i] }))
      if (next.length < 2) setCompareMode(false)
      return next
    })
  }

  const isCurrentSaved = result
    ? savedAlts.some(a => JSON.stringify(a.inputs) === JSON.stringify(result.inputs))
    : false

  // ── 저장된 대안 바 ───────────────────────────────────────────────────────
  const renderSavedAltsBar = () => {
    if (savedAlts.length === 0) return null
    return (
      <div className="border-t border-border px-4 py-2 bg-muted/30 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground font-medium">저장된 대안:</span>
        {savedAlts.map((alt, i) => (
          <span
            key={i}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium"
          >
            {alt.label}
            <button
              onClick={() => handleRemoveAlt(i)}
              className="hover:text-red-500 transition-colors ml-0.5"
              title={`${alt.label} 삭제`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {savedAlts.length >= 2 && (
          <button
            onClick={() => setCompareMode(v => !v)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors",
              compareMode
                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                : "bg-accent text-foreground hover:bg-border"
            )}
          >
            <BarChart2 className="h-3 w-3" />
            {compareMode ? "비교 종료" : "비교 보기"}
          </button>
        )}
      </div>
    )
  }

  // ── 대안 비교 테이블 ─────────────────────────────────────────────────────
  if (compareMode && savedAlts.length >= 2) {
    const baseParams = savedAlts[0].result.params
    const grouped = {}
    for (const p of baseParams) {
      if (!grouped[p.category]) grouped[p.category] = []
      grouped[p.category].push(p)
    }

    return (
      <div className="rounded-xl border border-border bg-background overflow-hidden text-sm w-full">
        {/* 헤더 */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              대안 비교
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {savedAlts.map(a =>
                `${a.label}: ${a.inputs.road_grade} ${a.inputs.design_speed}km/h ${a.inputs.terrain}`
              ).join(" | ")}
            </p>
          </div>
          <button
            onClick={() => setCompareMode(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-foreground text-xs font-medium hover:bg-border transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            비교 종료
          </button>
        </div>

        {/* 비교 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold border-b border-border w-14">구분</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-border">항목</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-border w-10">단위</th>
                {savedAlts.map(alt => (
                  <th key={alt.label} className="px-3 py-2 text-center font-semibold border-b border-border w-20">
                    {alt.label}
                  </th>
                ))}
              </tr>
              {/* 설계 조건 서브헤더 */}
              <tr className="bg-muted/30">
                <td className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground font-medium" colSpan={3}>
                  설계 조건
                </td>
                {savedAlts.map(alt => (
                  <td
                    key={alt.label}
                    className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground text-center leading-snug"
                  >
                    {alt.inputs.road_grade} · {alt.inputs.design_speed}km/h<br />
                    {alt.inputs.terrain} · {alt.inputs.region}<br />
                    {alt.inputs.lane_count}차로
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([cat, params]) =>
                params.map((p, i) => {
                  const values = savedAlts.map(alt => {
                    const found = alt.result.params.find(ap => ap.name === p.name)
                    return found ? found.value : "—"
                  })
                  const allSame = values.every(v => v === values[0])
                  return (
                    <tr
                      key={`${cat}-${i}`}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      {i === 0 ? (
                        <td
                          rowSpan={params.length}
                          className={cn(
                            "px-3 py-2 text-center font-semibold align-middle border-r border-border",
                            CATEGORY_COLOR[cat] ?? "bg-muted"
                          )}
                        >
                          {cat}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-foreground">{p.name}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{p.unit}</td>
                      {values.map((val, j) => (
                        <td
                          key={j}
                          className={cn(
                            "px-3 py-2 text-center font-semibold tabular-nums",
                            allSame
                              ? "text-primary"
                              : "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"
                          )}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border">
          ※ 노란색 셀은 대안 간 값이 다른 항목입니다.
        </p>

        {renderSavedAltsBar()}
      </div>
    )
  }

  // ── 결과 화면 ────────────────────────────────────────────────────────────
  if (result) {
    // 구분별로 그룹핑
    const grouped = {}
    for (const p of result.params) {
      if (!grouped[p.category]) grouped[p.category] = []
      grouped[p.category].push(p)
    }

    return (
      <div className="rounded-xl border border-border bg-background overflow-hidden text-sm w-full">
        {/* 헤더 */}
        <div className="bg-primary/10 border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-semibold text-foreground">설계 파라미터 산출 결과</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {result.inputs.road_grade} · {result.inputs.design_speed} km/h ·{" "}
              {result.inputs.terrain} · {result.inputs.region} · {result.inputs.lane_count}차로
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSaveAlt}
              disabled={isCurrentSaved || savedAlts.length >= 3}
              title={
                isCurrentSaved ? "이미 저장된 대안입니다"
                : savedAlts.length >= 3 ? "최대 3개까지 저장 가능합니다"
                : "현재 결과를 대안으로 저장"
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                isCurrentSaved
                  ? "bg-muted text-muted-foreground cursor-default"
                  : savedAlts.length >= 3
                    ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                    : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-950/60"
              )}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              {isCurrentSaved ? "저장됨" : "대안 저장"}
            </button>
            <button
              onClick={handleExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              보고서 다운로드
            </button>
            <button
              onClick={() => { setShowValidation(v => !v); setValidation(null) }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                showValidation
                  ? "bg-primary/20 text-primary hover:bg-primary/30"
                  : "bg-accent text-foreground hover:bg-border"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              기준 검증
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-foreground text-xs font-medium hover:bg-border transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 계산
            </button>
          </div>
        </div>

        {/* 결과 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold border-b border-border w-14">구분</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-border">항목</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-border w-20">기준값</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-border w-10">단위</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-border">적용 조건 / 산출 공식</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-border">근거 조항</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([cat, params]) =>
                params.map((p, i) => (
                  <tr
                    key={`${cat}-${i}`}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    {i === 0 ? (
                      <td
                        rowSpan={params.length}
                        className={cn(
                          "px-3 py-2 text-center font-semibold align-middle border-r border-border",
                          CATEGORY_COLOR[cat] ?? "bg-muted"
                        )}
                      >
                        {cat}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-foreground">{p.name}</td>
                    <td className="px-3 py-2 text-center font-semibold tabular-nums text-primary">
                      {p.value}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{p.unit}</td>
                    <td className="px-3 py-2 text-muted-foreground leading-relaxed">
                      <span>{p.condition}</span>
                      {p.formula && (
                        <span className="block mt-0.5 text-[10px] text-blue-500 dark:text-blue-400 font-mono leading-snug">
                          {p.formula}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[10px] leading-relaxed">
                      {p.source}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── 기준값 검증 패널 ── */}
        {showValidation && (
          <div className="border-t border-border">
            {/* 검증 헤더 + 요약 */}
            <div className="px-4 py-2 bg-muted/40 flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                설계값 기준 검증
              </p>
              {validation && (
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600 dark:text-green-400">✅ {validation.summary.pass}개 충족</span>
                  {validation.summary.fail > 0 && (
                    <span className="text-red-600 dark:text-red-400">❌ {validation.summary.fail}개 미달</span>
                  )}
                  {validation.summary.skip > 0 && (
                    <span className="text-muted-foreground">⬜ {validation.summary.skip}개 미입력</span>
                  )}
                </div>
              )}
            </div>

            {/* 입력 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold border-b border-border">항목</th>
                    <th className="px-3 py-2 text-center font-semibold border-b border-border w-20">기준값</th>
                    <th className="px-3 py-2 text-center font-semibold border-b border-border w-10">단위</th>
                    <th className="px-3 py-2 text-center font-semibold border-b border-border w-28">설계값 입력</th>
                    <th className="px-3 py-2 text-center font-semibold border-b border-border w-16">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {result.params
                    .filter(p => p.value !== "해당 없음" && p.value !== null)
                    .map((p, i) => {
                      const vItem = validation?.items?.find(v => v.name === p.name)
                      return (
                        <tr
                          key={i}
                          className={cn(
                            "border-b border-border/50 transition-colors",
                            vItem?.status === "fail" && "bg-red-50/70 dark:bg-red-950/25",
                            vItem?.status === "pass" && "bg-green-50/50 dark:bg-green-950/15",
                          )}
                        >
                          <td className="px-3 py-1.5 text-foreground">{p.name}</td>
                          <td className="px-3 py-1.5 text-center tabular-nums">
                            <span className="text-muted-foreground text-[10px] mr-0.5">{getLimitLabel(p.name)}</span>
                            <span className="font-semibold text-primary">{p.value}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center text-muted-foreground">{p.unit}</td>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="number"
                              value={designValues[p.name] ?? ""}
                              onChange={e => setDesignValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                              placeholder="—"
                              step="any"
                              className="w-22 px-2 py-0.5 border border-border rounded text-center text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {vItem ? (
                              vItem.status === "pass" ? (
                                <span className="text-green-600 dark:text-green-400 font-semibold">✅</span>
                              ) : vItem.status === "fail" ? (
                                <span
                                  className="text-red-600 dark:text-red-400 font-semibold cursor-help"
                                  title={vItem.message}
                                >❌</span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )
                            ) : (
                              <span className="text-muted-foreground text-[10px]">미입력</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* 미달 항목 상세 */}
            {validation?.summary?.fail > 0 && (
              <div className="mx-4 my-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">❌ 기준 미달 항목</p>
                {validation.items.filter(v => v.status === "fail").map((v, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                    • <span className="font-medium">{v.name}</span>: {v.message}
                  </p>
                ))}
              </div>
            )}

            {/* 검증 버튼 */}
            <div className="px-4 py-3 border-t border-border flex justify-end">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {validating ? "검증 중…" : "검증하기"}
              </button>
            </div>
          </div>
        )}

        <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border">
          ※ 산출값은 국토교통부 도로설계기준 기반 최솟값(또는 최댓값)입니다. 현장 여건에 따라 검토 후 적용하세요.
        </p>

        {renderSavedAltsBar()}
      </div>
    )
  }

  // ── 입력 폼 ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden text-sm w-full max-w-lg">
      {/* 헤더 + 선택 요약 */}
      <div className="bg-primary/10 border-b border-border px-4 py-3">
        <p className="font-semibold text-foreground">설계 파라미터 산출</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {STEPS.map((s, i) => (
            <span key={s.key} className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className={cn(i < step ? "text-primary font-medium" : i === step ? "text-foreground font-semibold" : "")}>
                {s.label}
              </span>
              <ChevronRight className="h-2.5 w-2.5 opacity-40" />
              <span className={cn(inputs[s.key] != null ? "text-primary font-medium" : "opacity-40")}>
                {inputs[s.key] != null ? String(inputs[s.key]) + (s.key === "design_speed" ? " km/h" : s.key === "lane_count" ? "차로" : "") : "—"}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 현재 스텝 */}
      <div className="px-4 py-4">
        {loading ? (
          <p className="text-muted-foreground text-sm animate-pulse text-center py-4">계산 중…</p>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-destructive text-sm mb-3">{error}</p>
            <button onClick={handleReset} className="text-xs text-primary underline">처음부터 다시</button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground mb-3">{currentStep.question}</p>
            <div className="flex flex-wrap gap-2">
              {getOptions(currentStep).map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                    "bg-background border-border text-foreground",
                    "hover:bg-primary hover:text-white hover:border-primary"
                  )}
                >
                  {String(opt)}{currentStep.key === "design_speed" ? " km/h" : currentStep.key === "lane_count" ? "차로" : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {renderSavedAltsBar()}
    </div>
  )
}
