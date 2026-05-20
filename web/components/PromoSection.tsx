import type { PromoStatusData } from '@/lib/types'
import SectionDivider from '@/components/SectionDivider'

interface Props {
  data: PromoStatusData[]
}

const PROMO_LABELS: Record<string, string> = {
  olivepick:     '올영픽',
  today_deal:    '오늘의 특가',
  daily_special: '하루특가',
}

export default function PromoSection({ data }: Props) {
  if (data.length === 0) return null

  return (
    <section>
      <SectionDivider tag="Promo" />
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold text-text-primary">프로모션 입점 현황</h2>
        <span className="text-sm text-text-tertiary">올영픽 · 오특 · 하루특가</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.map(d => {
          const label = PROMO_LABELS[d.promo_type] ?? d.promo_type
          const hasOurs = d.our_items.length > 0
          return (
            <div
              key={d.promo_type}
              className={`rounded-lg border p-4 space-y-2 ${
                hasOurs
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-surface border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{label}</span>
                {hasOurs ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                    입점 ✓
                  </span>
                ) : (
                  <span className="text-xs text-text-tertiary bg-surface-raised border border-border-subtle px-2 py-0.5 rounded-full">
                    미입점
                  </span>
                )}
              </div>

              {hasOurs ? (
                <ul className="space-y-1">
                  {d.our_items.map(item => (
                    <li key={item.goods_no} className="flex items-center justify-between text-xs text-emerald-800">
                      <span className="truncate flex-1 mr-2">{item.goods_name}</span>
                      {item.rank_position != null && (
                        <span className="shrink-0 font-semibold">{item.rank_position}위</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-tertiary">오늘 셀퓨전씨 상품 없음</p>
              )}

              <p className="text-[11px] text-text-tertiary">전체 {d.total_count}개 상품</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
