'use client'

import { useState, useEffect } from 'react'
import type { BrandEvent } from '@/lib/types'

const EVENT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  olivepick_entry: { label: '올영픽 입점',  color: 'text-green-600 bg-green-50 border-green-200',  icon: '★' },
  olivepick_exit:  { label: '올영픽 이탈',  color: 'text-gray-500 bg-gray-50 border-gray-200',     icon: '☆' },
  rank_jump:       { label: '순위 급등',     color: 'text-blue-600 bg-blue-50 border-blue-200',     icon: '↑' },
  review_surge:    { label: '리뷰 급증',     color: 'text-purple-600 bg-purple-50 border-purple-200', icon: '📝' },
  new_product:     { label: '신제품 등록',   color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '✦' },
  price_drop:      { label: '가격 급락',     color: 'text-red-600 bg-red-50 border-red-200',        icon: '↓' },
  action_taken:    { label: '우리 실행',     color: 'text-accent bg-accent-bg border-accent-border', icon: '✓' },
}

function str(v: unknown): string { return v != null ? String(v) : '' }

function EventDetail({ event }: { event: BrandEvent }) {
  const d = event.event_detail as Record<string, unknown>
  switch (event.event_type) {
    case 'rank_jump':
      return <span>{str(d.rank_before)}위 → {str(d.rank_after)}위 ({event.category_name})</span>
    case 'review_surge':
      return <span>이번 주 {str(d.this_week)}건 (전주 {str(d.prev_week)}건, +{str(d.surge_pct)}%)</span>
    case 'price_drop':
      return <span>{Number(d.price_before).toLocaleString()}원 → {Number(d.price_after).toLocaleString()}원 (-{str(d.drop_pct)}%)</span>
    case 'olivepick_entry':
    case 'olivepick_exit':
      return <span>{str(d.category_name ?? event.category_name)}{d.rank_position ? ` ${str(d.rank_position)}위` : ''}</span>
    case 'action_taken':
      return <span>{str(d.action_type)}{d.memo ? ` — ${str(d.memo)}` : ''} / 목표: {str(d.target_metric)}</span>
    default:
      return <span>{str(d.goods_name)}</span>
  }
}

export default function BrandTimeline() {
  const [brands, setBrands] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('')
  const [events, setEvents] = useState<BrandEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/brand-events?names=1')
      .then(r => r.json())
      .then((data: string[]) => { setBrands(data); if (data.length > 0) setSelected(data[0]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    fetch(`/api/brand-events?brand=${encodeURIComponent(selected)}&limit=60`)
      .then(r => r.json())
      .then((data: BrandEvent[]) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [selected])

  if (brands.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg px-6 py-10 text-center">
        <p className="text-sm text-text-secondary">아직 감지된 브랜드 이벤트가 없습니다</p>
        <p className="text-xs text-text-tertiary mt-1">매일 오전 7시 자동 감지됩니다</p>
      </div>
    )
  }

  return (
    <div>
      {/* 브랜드 선택 */}
      <div className="flex items-center gap-3 mb-5">
        <label className="text-xs font-medium text-text-secondary shrink-0">브랜드 선택</label>
        <select
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-surface text-text-primary"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          {brands.map(b => <option key={b}>{b}</option>)}
        </select>
        <span className="text-xs text-text-tertiary">{events.length}건</span>
      </div>

      {/* 타임라인 */}
      {loading ? (
        <div className="py-8 text-center text-sm text-text-tertiary">불러오는 중…</div>
      ) : events.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-tertiary">이벤트 없음</div>
      ) : (
        <div className="relative">
          {/* 세로 선 */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {events.map(ev => {
              const style = EVENT_LABELS[ev.event_type] ?? { label: ev.event_type, color: 'text-text-secondary bg-muted border-border', icon: '·' }
              return (
                <div key={ev.id} className="flex items-start gap-3 relative">
                  {/* 아이콘 */}
                  <div className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold z-10 ${style.color}`}>
                    {style.icon}
                  </div>
                  {/* 내용 */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${style.color}`}>{style.label}</span>
                      <span className="text-xs text-text-tertiary">{ev.event_date}</span>
                      {ev.source === 'user' && (
                        <span className="text-[10px] bg-accent-bg text-accent border border-accent-border px-1 py-0.5 rounded">내 기록</span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5">
                      <EventDetail event={ev} />
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
