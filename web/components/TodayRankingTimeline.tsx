'use client'

import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { OurRankingTimelineEntry } from '@/lib/types'
import SectionDivider from '@/components/SectionDivider'

interface Props {
  data: OurRankingTimelineEntry[]
}

function fmtHour(h: number): string {
  return h === 0 ? '자정' : h < 12 ? `오전 ${h}시` : h === 12 ? '오후 12시' : `오후 ${h - 12}시`
}

const CATEGORY_ORDER = ['전체', '스킨케어', '마스크팩', '클렌징', '선케어', '더모 코스메틱', '바디케어', '맨즈에딧']

function SparkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (d.pos == null) return null
  return (
    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md shadow-lg">
      {fmtHour(d.h)} · <strong>{d.pos}위</strong>
    </div>
  )
}

function SparkLine({
  snaps, allHours,
}: {
  snaps: { rank_hour: number; rank_position: number }[]
  allHours: number[]
}) {
  const snapMap = new Map(snaps.map(s => [s.rank_hour, s.rank_position]))
  const chartData = allHours.map(h => ({ h, pos: snapMap.get(h) }))

  const positions = snaps.map(s => s.rank_position)
  const bestPos   = Math.min(...positions)
  const firstPos  = snapMap.get(allHours[0])
  const lastPos   = snapMap.get(allHours[allHours.length - 1])
  const delta     = firstPos != null && lastPos != null ? firstPos - lastPos : null

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {/* 스파크라인 */}
      <div className="flex-1 min-w-[80px] max-w-[200px]">
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 6 }}>
            <YAxis domain={['dataMax + 2', 'dataMin - 2']} hide reversed />
            <Tooltip content={<SparkTooltip />} />
            <Line
              type="monotone"
              dataKey="pos"
              stroke="#EA580C"
              strokeWidth={2}
              dot={{ r: 3, fill: '#EA580C', strokeWidth: 0 }}
              activeDot={{ r: 4, fill: '#C2410C' }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 현재 순위 + 변동 */}
      <div className="shrink-0 text-right min-w-[56px]">
        {lastPos != null && (
          <p className={`text-sm font-bold leading-tight ${lastPos === bestPos ? 'text-accent' : 'text-text-primary'}`}>
            {lastPos === bestPos && <span className="mr-0.5">✦</span>}{lastPos}위
          </p>
        )}
        {delta != null && delta !== 0 && (
          <p className={`text-[11px] font-medium leading-tight ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
          </p>
        )}
        {bestPos <= 3 && lastPos !== bestPos && lastPos != null && (
          <p className="text-[10px] text-accent/60 leading-tight">최고 {bestPos}위</p>
        )}
      </div>
    </div>
  )
}

export default function TodayRankingTimeline({ data }: Props) {
  if (data.length === 0) return (
    <section>
      <SectionDivider tag="오늘 순위 타임라인" />
      <div className="border border-dashed border-border rounded-lg px-6 py-8 text-center">
        <p className="text-sm text-text-secondary">오늘 수집된 순위 데이터가 없어요</p>
        <p className="text-xs text-text-tertiary mt-1">3시간마다 자동 수집됩니다</p>
      </div>
    </section>
  )

  const productMap = new Map<string, { goods_name: string; categories: Map<string, { rank_hour: number; rank_position: number }[]> }>()
  for (const e of data) {
    if (!productMap.has(e.goods_no)) {
      productMap.set(e.goods_no, { goods_name: e.goods_name, categories: new Map() })
    }
    const prod = productMap.get(e.goods_no)!
    if (!prod.categories.has(e.category_name)) prod.categories.set(e.category_name, [])
    prod.categories.get(e.category_name)!.push({ rank_hour: e.rank_hour, rank_position: e.rank_position })
  }

  const achievements: { goods_name: string; category_name: string; rank_position: number; rank_hour: number }[] = []
  for (const [, prod] of productMap) {
    for (const [cat, snaps] of prod.categories) {
      const best = snaps.reduce((a, b) => a.rank_position <= b.rank_position ? a : b)
      if (best.rank_position <= 3) {
        achievements.push({ goods_name: prod.goods_name, category_name: cat, rank_position: best.rank_position, rank_hour: best.rank_hour })
      }
    }
  }
  achievements.sort((a, b) => a.rank_position - b.rank_position)

  const products = Array.from(productMap.entries())

  return (
    <section>
      <SectionDivider tag="오늘 순위 타임라인" />
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold text-text-primary">오늘 시간별 순위 추이</h2>
        <span className="text-sm text-text-tertiary">3시간 간격</span>
      </div>

      {achievements.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {achievements.map((a, i) => (
            <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-bg border border-accent-border">
              <span className="text-accent font-bold text-sm">✦</span>
              <span className="text-xs font-semibold text-accent-fg">
                {fmtHour(a.rank_hour)} {a.category_name} {a.rank_position}위 달성
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {products.map(([goods_no, prod]) => {
          const sortedCats = Array.from(prod.categories.entries()).sort(([a], [b]) => {
            const ia = CATEGORY_ORDER.indexOf(a)
            const ib = CATEGORY_ORDER.indexOf(b)
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
          })

          const allHours = Array.from(
            new Set(Array.from(prod.categories.values()).flatMap(snaps => snaps.map(s => s.rank_hour)))
          ).sort((a, b) => a - b)

          if (allHours.length < 2) return null

          return (
            <div key={goods_no} className="border border-border rounded-lg bg-surface p-4 space-y-3">
              <p className="text-sm font-semibold text-text-primary">★ {prod.goods_name}</p>

              {/* 시간 축 헤더 */}
              <div className="flex items-center gap-3 px-0">
                <span className="shrink-0 w-24 text-[11px] text-text-tertiary">카테고리</span>
                <div className="flex-1 flex justify-between text-[10px] text-text-tertiary px-1">
                  {allHours.map(h => (
                    <span key={h}>{h}시</span>
                  ))}
                </div>
                <span className="shrink-0 min-w-[56px] text-[11px] text-text-tertiary text-right">최신</span>
              </div>

              <div className="divide-y divide-border/50 -mx-1">
                {sortedCats.map(([catName, snaps]) => (
                  <div key={catName} className="flex items-center gap-3 py-1.5 px-1">
                    <span className="shrink-0 text-xs text-text-secondary w-24 truncate">{catName}</span>
                    <SparkLine snaps={snaps} allHours={allHours} />
                  </div>
                ))}
              </div>
            </div>
          )
        }).filter(Boolean)}
      </div>
    </section>
  )
}
