import { useState } from "react"
import { Download, RefreshCw, ChevronRight } from "lucide-react"
import { cn } from "../lib/utils"

const API_URL = import.meta.env.VITE_API_URL || ""

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
  }

  const handleExcel = () => {
    if (!result) return
    const { road_grade, design_speed, terrain, region, lane_count } = result.inputs
    const params = new URLSearchParams({
      road_grade, design_speed, terrain, region, lane_count,
    })
    window.open(`${API_URL}/api/calc/excel?${params}`, "_blank")
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
        <div className="bg-primary/10 border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">설계 파라미터 산출 결과</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {result.inputs.road_grade} · {result.inputs.design_speed} km/h ·{" "}
              {result.inputs.terrain} · {result.inputs.region} · {result.inputs.lane_count}차로
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              엑셀 다운로드
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

        <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border">
          ※ 산출값은 국토교통부 도로설계기준 기반 최솟값(또는 최댓값)입니다. 현장 여건에 따라 검토 후 적용하세요.
        </p>
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
    </div>
  )
}
