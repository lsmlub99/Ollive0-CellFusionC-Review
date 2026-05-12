import type { ProductNegativeData } from '@/lib/types'
import { extractShortName, scoreStars, scoreColor } from '@/lib/utils'

interface Props {
  data: ProductNegativeData[]
}

export default function NegativeInsights({ data }: Props) {
  if (data.length === 0) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold text-text-primary">불만 포인트</h2>
        <span className="text-sm text-text-tertiary">상품별 1–2점 리뷰 분석</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map(product => (
          <div key={product.goods_no} className="border border-red-100 rounded-lg bg-surface overflow-hidden">
            {/* 상품 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 bg-red-50/60 border-b border-red-100">
              <span className="text-sm font-semibold text-text-primary">
                {extractShortName(product.goods_name)}
              </span>
              <span className="text-xs text-red-500 font-medium">
                1–2점 {product.neg_count}개
              </span>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* 키워드 */}
              {product.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {product.keywords.map((kw, i) => {
                    const maxCnt = product.keywords[0]?.cnt || 1
                    const intensity = kw.cnt / maxCnt
                    return (
                      <span
                        key={kw.word}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium"
                        style={{
                          backgroundColor: `rgba(220,38,38,${0.06 + intensity * 0.10})`,
                          borderColor: `rgba(220,38,38,${0.2 + intensity * 0.3})`,
                          color: `rgba(153,27,27,${0.7 + intensity * 0.3})`,
                        }}
                      >
                        #{kw.word}
                        <span className="opacity-50 text-2xs">{kw.cnt}</span>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* 샘플 리뷰 */}
              {product.samples.map((s, i) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  <span
                    className="shrink-0 font-bold text-xs mt-0.5"
                    style={{ color: scoreColor(s.score) }}
                  >
                    {scoreStars(s.score)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-secondary leading-relaxed line-clamp-2">
                      {s.content}
                    </p>
                    <p className="text-text-tertiary mt-0.5">{s.created_at?.slice(0, 10)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
