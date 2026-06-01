'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2 } from 'lucide-react'
import SectionDivider from '@/components/SectionDivider'

interface CoupangStats {
  total_reviews: number
  total_products: number
  avg_rating: number
  last_updated: string | null
}

interface CoupangProduct {
  product_id: string
  product_name: string | null
  review_count: number | null
}

interface CoupangReview {
  review_id: number
  product_id: string
  product_name: string | null
  content: string | null
  rating: number | null
  helpful_count: number
  purchased_option: string | null
  created_at: string
}

interface SearchRanking {
  keyword: string
  product_id: string
  product_name: string | null
  rank_position: number
  is_ad: boolean
  rank_date: string
}

interface CategoryRanking {
  category_name: string
  rank_position: number
  product_id: string
  product_name: string
  rank_date: string
  rank_hour: number
}

const TABS = [
  { id: 'today',    label: '오늘 현황' },
  { id: 'reviews',  label: '리뷰 분석' },
  { id: 'search',   label: '검색순위' },
  { id: 'category', label: '카테고리 순위' },
] as const
type TabId = typeof TABS[number]['id']

type RatingFilter = 'all' | 'five' | 'four_plus' | 'negative'

const RATING_FILTERS: { value: RatingFilter; label: string }[] = [
  { value: 'all',       label: '전체' },
  { value: 'five',      label: '★5 만족' },
  { value: 'four_plus', label: '★4 이상' },
  { value: 'negative',  label: '불만족' },
]

function ratingColor(r: number | null) {
  const n = r ?? 0
  if (n >= 5) return '#16A34A'
  if (n >= 4) return '#2D9C6E'
  if (n >= 3) return '#CA8A04'
  if (n >= 2) return '#EA580C'
  return '#DC2626'
}

function ratingStars(r: number | null) {
  const n = Math.max(0, Math.min(5, r ?? 0))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function shortProductName(name: string | null): string {
  if (!name) return ''
  return name.replace(/\[.*?\]\s*/g, '').replace(/^셀퓨전씨\s*/i, '').slice(0, 18).trim()
}

const isBrand = (name: string | null) => (name ?? '').includes('셀퓨전씨')

const PREVIEW_LEN = 120

function CoupangReviewCard({
  review,
  showProduct,
  onProductClick,
  index = 0,
}: {
  review: CoupangReview
  showProduct: boolean
  onProductClick: (id: string) => void
  index?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const content  = review.content ?? ''
  const isLong   = content.length > PREVIEW_LEN
  const color    = ratingColor(review.rating)
  const shortName = shortProductName(review.product_name)

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03, ease: [0.16, 1, 0.3, 1] }}
      className="bg-surface border border-border rounded-lg overflow-hidden hover:shadow-card-hover transition-all duration-200"
    >
      <div className="px-5 py-4 md:px-6 md:py-5">
        {/* 메타 행 */}
        <div className="flex items-center gap-2.5 flex-wrap mb-3">
          <span className="text-sm font-semibold tracking-wide" style={{ color }}>
            {ratingStars(review.rating)}
          </span>
          <span className="text-xs text-text-tertiary">{review.created_at}</span>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
            {showProduct && shortName && (
              <button
                onClick={() => onProductClick(review.product_id)}
                className="inline-flex items-center text-2xs font-semibold px-2 py-0.5 rounded-full
                           bg-purple-50 text-purple-700 border border-purple-100
                           hover:bg-purple-100 transition-colors duration-150"
                title={review.product_name ?? ''}
              >
                {shortName}
              </button>
            )}
            {review.purchased_option && (
              <span className="inline-flex items-center text-2xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {review.purchased_option.length > 16
                  ? review.purchased_option.slice(0, 16) + '…'
                  : review.purchased_option}
              </span>
            )}
            {review.helpful_count > 0 && (
              <span className="text-2xs text-text-tertiary">도움 {review.helpful_count}</span>
            )}
          </div>
        </div>

        {/* 본문 */}
        <AnimatePresence initial={false}>
          <motion.div
            key={expanded ? 'exp' : 'col'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-base text-text-primary"
            style={{ lineHeight: '1.85' }}
          >
            {expanded || !isLong
              ? content
              : content.slice(0, PREVIEW_LEN).trimEnd() + '...'}
          </motion.div>
        </AnimatePresence>

        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2.5 flex items-center gap-1 text-xs font-medium text-text-tertiary hover:text-accent transition-colors duration-150 group"
          >
            <span>{expanded ? '접기' : '더 보기'}</span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
    </motion.article>
  )
}

export default function CoupangDashboard() {
  const [active, setActive]         = useState<TabId>('today')
  const [loading, setLoading]       = useState(true)
  const [stats, setStats]           = useState<CoupangStats | null>(null)
  const [rankings, setRankings]     = useState<{ search: SearchRanking[]; category: CategoryRanking[] } | null>(null)
  const [products, setProducts]     = useState<CoupangProduct[]>([])

  const [selectedProduct, setSelectedProduct] = useState('')
  const [ratingFilter, setRatingFilter]       = useState<RatingFilter>('all')
  const [reviews, setReviews]                 = useState<CoupangReview[]>([])
  const [reviewTotal, setReviewTotal]         = useState(0)
  const [reviewPage, setReviewPage]           = useState(0)
  const [hasMore, setHasMore]                 = useState(false)
  const [reviewLoading, setReviewLoading]     = useState(false)
  const [loadingMore, setLoadingMore]         = useState(false)

  // 최초 데이터 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/coupang/stats').then(r => r.ok ? r.json() : null),
      fetch('/api/coupang/rankings').then(r => r.ok ? r.json() : null),
      fetch('/api/coupang/products').then(r => r.ok ? r.json() : []),
    ]).then(([s, r, p]) => {
      setStats(s)
      setRankings({
        search:   Array.isArray(r?.search)   ? r.search   : [],
        category: Array.isArray(r?.category) ? r.category : [],
      })
      setProducts(Array.isArray(p) ? p : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fetchReviews = useCallback(async (
    productId: string,
    filter: RatingFilter,
    page: number,
    append = false,
  ) => {
    if (append) setLoadingMore(true)
    else setReviewLoading(true)

    const params = new URLSearchParams({ page: String(page), filter })
    if (productId) params.set('productId', productId)

    try {
      const res = await fetch(`/api/coupang/reviews?${params}`)
      const d   = res.ok ? await res.json() : { reviews: [], total: 0, has_more: false }
      setReviews(prev => append ? [...prev, ...(d.reviews ?? [])] : (d.reviews ?? []))
      setReviewTotal(d.total ?? 0)
      setHasMore(d.has_more ?? false)
      setReviewPage(page)
    } catch {
      if (!append) setReviews([])
    } finally {
      setReviewLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // 최초 리뷰 로드
  useEffect(() => {
    fetchReviews('', 'all', 0)
  }, [fetchReviews])

  const handleProductChange = (id: string) => {
    setSelectedProduct(id)
    setRatingFilter('all')
    fetchReviews(id, 'all', 0)
  }

  const handleFilterChange = (f: RatingFilter) => {
    setRatingFilter(f)
    fetchReviews(selectedProduct, f, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-text-secondary">쿠팡 데이터 불러오는 중...</span>
      </div>
    )
  }

  const catList    = rankings?.category ?? []
  const searchList = rankings?.search ?? []

  const catGroups = catList.reduce<Record<string, CategoryRanking[]>>((acc, r) => {
    const key = r.category_name ?? '기타'
    acc[key] = acc[key] ?? []
    acc[key].push(r)
    return acc
  }, {})

  const searchGroups = searchList.reduce<Record<string, SearchRanking[]>>((acc, r) => {
    const key = r.keyword ?? '기타'
    acc[key] = acc[key] ?? []
    acc[key].push(r)
    return acc
  }, {})

  const brandProducts = catList.filter(r => isBrand(r.product_name))

  return (
    <div className="space-y-8">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 rounded-xl px-5 py-6 border" style={{ background: 'rgba(234,88,12,0.06)', borderColor: 'rgba(234,88,12,0.25)' }}>
          <p className="text-xs text-text-secondary mb-2 font-medium">평균 평점</p>
          <p className="text-[3.5rem] font-bold leading-none mb-1" style={{ color: '#ea580c' }}>
            {stats?.avg_rating != null ? Number(stats.avg_rating).toFixed(1) : '-'}
          </p>
          <p className="text-xs text-text-secondary/70">총 {(stats?.total_reviews ?? 0).toLocaleString()}개 리뷰</p>
        </div>
        <div className="rounded-xl px-4 py-5 border border-border bg-surface text-center">
          <p className="text-xs text-text-secondary mb-3">수집 상품</p>
          <p className="text-[2rem] font-bold leading-none mb-2 text-text-primary">{stats?.total_products ?? 0}</p>
          <p className="text-xs text-text-secondary/70">개 상품</p>
        </div>
        <div className="rounded-xl px-4 py-5 border border-border bg-surface text-center">
          <p className="text-xs text-text-secondary mb-3">카테고리 입점</p>
          <p className="text-[2rem] font-bold leading-none mb-2 text-text-primary">{Object.keys(catGroups).length}</p>
          <p className="text-xs text-text-secondary/70">개 카테고리</p>
        </div>
      </div>

      {/* 탭 바 */}
      <div className="border-b border-border sticky top-14 z-30 bg-background/95 backdrop-blur-sm">
        <nav className="flex gap-0 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                active === tab.id
                  ? 'border-accent text-text-primary'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {/* 오늘 현황 */}
        {active === 'today' && (
          <div className="space-y-8">
            {brandProducts.length > 0 ? (
              <div>
                <SectionDivider tag="자사 입점 현황" />
                <div className="space-y-2">
                  {brandProducts.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface">
                      <span className="text-lg font-bold text-accent w-10 text-right shrink-0">{r.rank_position}위</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{r.product_name}</p>
                        <p className="text-xs text-text-tertiary">{r.category_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg px-6 py-12 text-center">
                <p className="text-sm text-text-secondary">카테고리 내 자사 상품이 없어요</p>
                <p className="text-xs text-text-tertiary mt-1">순위 수집 후 데이터가 표시됩니다</p>
              </div>
            )}

            {Object.keys(catGroups).length > 0 && (
              <div>
                <SectionDivider tag="카테고리 현황" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(catGroups).map(([cat, items]) => (
                    <div key={cat} className="rounded-lg border border-border bg-surface px-4 py-4">
                      <p className="text-xs font-semibold text-text-secondary mb-3">{cat}</p>
                      <ol className="space-y-1.5">
                        {items.slice(0, 10).map(item => (
                          <li key={item.rank_position} className="flex items-center gap-2 text-sm">
                            <span className={`w-5 text-right text-xs font-bold shrink-0 ${item.rank_position <= 3 ? 'text-accent' : 'text-text-tertiary'}`}>
                              {item.rank_position}
                            </span>
                            <span className={`truncate ${isBrand(item.product_name) ? 'text-accent font-semibold' : 'text-text-primary'}`}>
                              {item.product_name}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 리뷰 분석 */}
        {active === 'reviews' && (
          <section>
            {/* 상품 선택 */}
            <div className="mb-4">
              <select
                value={selectedProduct}
                onChange={e => handleProductChange(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-base text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50
                           appearance-none cursor-pointer transition-colors"
              >
                <option value="">전체 상품</option>
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>
                    {(p.product_name ?? p.product_id).length > 42
                      ? (p.product_name ?? p.product_id).slice(0, 42) + '…'
                      : (p.product_name ?? p.product_id)}
                  </option>
                ))}
              </select>
            </div>

            {/* 별점 필터 */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
              {RATING_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => handleFilterChange(f.value)}
                  className={`flex-none px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                    ratingFilter === f.value
                      ? 'bg-text-primary text-white'
                      : 'bg-surface border border-border text-text-secondary hover:border-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 리뷰 수 */}
            <p className="text-xs text-text-tertiary mb-4">{reviewTotal.toLocaleString()}개 리뷰</p>

            {/* 리뷰 목록 */}
            {reviewLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-surface border border-border rounded-lg p-5">
                    <div className="skeleton h-3 w-32 rounded mb-3" />
                    <div className="skeleton h-3 w-full rounded mb-2" />
                    <div className="skeleton h-3 w-4/5 rounded mb-2" />
                    <div className="skeleton h-3 w-3/5 rounded" />
                  </div>
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-16 text-text-tertiary text-sm">해당 조건의 리뷰가 없습니다</div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${selectedProduct}-${ratingFilter}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2.5"
                  >
                    {reviews.map((rv, i) => (
                      <CoupangReviewCard
                        key={rv.review_id}
                        review={rv}
                        showProduct={!selectedProduct}
                        onProductClick={handleProductChange}
                        index={i}
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>

                {hasMore && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => fetchReviews(selectedProduct, ratingFilter, reviewPage + 1, true)}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border
                                 text-sm font-medium text-text-secondary hover:text-text-primary
                                 hover:border-text-tertiary transition-all duration-150 disabled:opacity-50"
                    >
                      {loadingMore
                        ? <><Loader2 size={14} className="animate-spin" /> 불러오는 중</>
                        : '리뷰 더 보기'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* 검색순위 */}
        {active === 'search' && (
          <div className="space-y-6">
            {Object.keys(searchGroups).length === 0 ? (
              <div className="border border-dashed border-border rounded-lg px-6 py-12 text-center">
                <p className="text-sm text-text-secondary">검색순위 데이터가 없어요</p>
              </div>
            ) : (
              Object.entries(searchGroups).map(([keyword, items]) => (
                <div key={keyword}>
                  <SectionDivider tag={`키워드: ${keyword}`} />
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.product_id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface">
                        <span className={`text-sm font-bold w-8 text-right shrink-0 ${item.rank_position <= 3 ? 'text-accent' : 'text-text-tertiary'}`}>
                          {item.rank_position === 0 ? '광고' : `${item.rank_position}위`}
                        </span>
                        <span className={`text-sm truncate flex-1 ${isBrand(item.product_name) ? 'text-accent font-semibold' : 'text-text-primary'}`}>
                          {item.product_name ?? '-'}
                        </span>
                        {item.is_ad && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 shrink-0">광고</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 카테고리 순위 */}
        {active === 'category' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {Object.keys(catGroups).length === 0 ? (
              <div className="sm:col-span-3 border border-dashed border-border rounded-lg px-6 py-12 text-center">
                <p className="text-sm text-text-secondary">카테고리 순위 데이터가 없어요</p>
              </div>
            ) : (
              Object.entries(catGroups).map(([cat, items]) => (
                <div key={cat}>
                  <SectionDivider tag={cat} />
                  <ol className="space-y-2">
                    {items.slice(0, 30).map(item => (
                      <li key={item.rank_position}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                            isBrand(item.product_name) ? 'border-accent/30 bg-accent-bg' : 'border-border bg-surface'
                          }`}>
                        <span className={`text-sm font-bold w-7 text-right shrink-0 ${item.rank_position <= 3 ? 'text-accent' : 'text-text-tertiary'}`}>
                          {item.rank_position}
                        </span>
                        <span className={`text-sm truncate ${isBrand(item.product_name) ? 'text-accent font-semibold' : 'text-text-primary'}`}>
                          {item.product_name}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
