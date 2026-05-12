import type { NegativeInsightsData } from '@/lib/types'

interface Props {
  data: NegativeInsightsData
}

const SCORE_COLORS = ['#DC2626', '#EA580C', '#CA8A04', '#2D9C6E', '#16A34A']

export default function NegativeInsights({ data }: Props) {
  const { keywords, samples, total_neg } = data

  if (total_neg === 0) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold text-text-primary">불만 포인트</h2>
        <span className="text-sm text-text-tertiary">1–2점 리뷰 {total_neg.toLocaleString()}개 기준</span>
      </div>

      {/* 키워드 클라우드 */}
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw, i) => {
          const maxCnt = keywords[0]?.cnt || 1
          const intensity = kw.cnt / maxCnt
          const opacity = 0.4 + intensity * 0.6
          return (
            <span
              key={kw.word}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: `rgba(220, 38, 38, ${intensity * 0.12})`,
                borderColor: `rgba(220, 38, 38, ${opacity * 0.5})`,
                color: `rgba(185, 28, 28, ${0.6 + intensity * 0.4})`,
              }}
            >
              #{kw.word}
              <span className="text-2xs opacity-70">{kw.cnt}</span>
            </span>
          )
        })}
      </div>

      {/* 샘플 리뷰 */}
      {samples.length > 0 && (
        <div className="space-y-2">
          <p className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider">최근 불만 리뷰</p>
          <div className="space-y-2">
            {samples.map(r => (
              <div key={r.review_id} className="flex gap-3 p-3 rounded-lg bg-red-50/60 border border-red-100">
                <span
                  className="shrink-0 text-xs font-bold mt-0.5"
                  style={{ color: SCORE_COLORS[(r.score ?? 1) - 1] }}
                >
                  {'★'.repeat(r.score ?? 1)}{'☆'.repeat(5 - (r.score ?? 1))}
                </span>
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                  {r.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
