'use client'

import type { OurRankingTimelineEntry } from '@/lib/types'
import SectionDivider from '@/components/SectionDivider'

interface Props {
  data: OurRankingTimelineEntry[]
}

function fmtHour(h: number): string {
  return h === 0 ? '자정' : h < 12 ? `오전 ${h}시` : h === 12 ? '정오' : `오후 ${h - 12}시`
}

const CATEGORY_ORDER = ['전체', '스킨케어', '마스크팩', '클렌징', '선케어', '더모 코스메틱', '바디케어', '맨즈에딧']

function rankColor(rank: number): string {
  if (rank <= 10) return '#16A34A'
  if (rank <= 30) return '#2563EB'
  if (rank <= 60) return '#CA8A04'
  return '#78716C'
}

export default function TodayRankingTimeline({ data }: Props) {
  if (data.length === 0) return (
    <section>
      <SectionDivider tag="오늘 순위 타임라인" />
      <div className="border border-dashed border-border rounded-lg px-6 py-8 text-center">
        <p className="text-sm text-text-secondary">오늘 수집된 순위 데이터가 없어요</p>
        <p className="text-xs text-text-tertiary mt-1">매 정시 자동 수집됩니다</p>
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

  const allHoursGlobal = Array.from(
    new Set(data.map(e => e.rank_hour))
  ).sort((a, b) => a - b)

  const products = Array.from(productMap.entries()).filter(([, prod]) => {
    const uniqueHours = new Set(Array.from(prod.categories.values()).flatMap(s => s.map(x => x.rank_hour)))
    return uniqueHours.size >= 1
  })

  return (
    <section>
      <SectionDivider tag="오늘 순위 타임라인" />
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold text-text-primary">오늘 시간별 순위 추이</h2>
        <span className="text-xs text-text-tertiary bg-muted px-2 py-0.5 rounded-full border border-border">
          {allHoursGlobal.length}회 수집
        </span>
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

          return (
            <div key={goods_no} className="border border-border rounded-lg bg-surface p-4 space-y-2">
              <p className="text-sm font-semibold text-text-primary">★ {prod.goods_name}</p>
              <div className="divide-y divide-border/50">
                {sortedCats.map(([catName, snaps]) => {
                  const sorted    = [...snaps].sort((a, b) => a.rank_hour - b.rank_hour)
                  const firstSnap = sorted[0]
                  const lastSnap  = sorted[sorted.length - 1]
                  const delta     = firstSnap.rank_position - lastSnap.rank_position
                  const bestPos   = Math.min(...snaps.map(s => s.rank_position))
                  const snapCount = sorted.length

                  return (
                    <div key={catName} className="py-2.5">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="shrink-0 text-xs text-text-secondary w-24 truncate font-medium">{catName}</span>
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <span className="font-bold" style={{ color: rankColor(firstSnap.rank_position) }}>{firstSnap.rank_position}위</span>
                          <span className="text-text-tertiary text-xs">→</span>
                          <span className="font-bold" style={{ color: rankColor(lastSnap.rank_position) }}>{lastSnap.rank_position}위</span>
                        </div>
                        {delta !== 0 && (
                          <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                          </span>
                        )}
                        {bestPos <= 3 && lastSnap.rank_position !== bestPos && (
                          <span className="text-[10px] text-accent/70">최고 {bestPos}위</span>
                        )}
                        <span className="ml-auto text-[10px] text-text-tertiary">{snapCount}회 측정</span>
                      </div>

                      {/* 시간별 스냅샷 */}
                      {(() => {
                        const allSame = sorted.every(s => s.rank_position === sorted[0].rank_position)
                        if (allSame) {
                          return (
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{ color: rankColor(sorted[0].rank_position), background: `${rankColor(sorted[0].rank_position)}14` }}
                              >
                                {sorted[0].rank_position}위
                              </span>
                              <span className="text-[10px] text-text-tertiary">종일 유지 ({sorted.length}회 확인)</span>
                            </div>
                          )
                        }
                        return (
                          <div className="flex items-end gap-1 flex-wrap">
                            {sorted.map((snap, i) => {
                              const prevRank = i > 0 ? sorted[i - 1].rank_position : null
                              const isImproved = prevRank !== null && snap.rank_position < prevRank
                              const isWorsened = prevRank !== null && snap.rank_position > prevRank
                              return (
                                <div key={snap.rank_hour} className="flex flex-col items-center gap-0.5">
                                  <span
                                    className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded"
                                    style={{ color: rankColor(snap.rank_position), background: `${rankColor(snap.rank_position)}14` }}
                                  >
                                    {snap.rank_position}위
                                  </span>
                                  <span className="text-[9px] text-text-tertiary/70 whitespace-nowrap">{fmtHour(snap.rank_hour)}</span>
                                  {isImproved && <span className="text-[8px] text-emerald-500 leading-none">↑</span>}
                                  {isWorsened && <span className="text-[8px] text-red-400 leading-none">↓</span>}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
