'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { OlivepickMonth, PromoMonthlyInsight } from '@/lib/types'
import OlivepickMonthAccordion from './OlivepickMonthAccordion'
import SectionDivider from './SectionDivider'

export default function OlivepickTab() {
  const [data, setData] = useState<OlivepickMonth[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [showOursOnly, setShowOursOnly] = useState(false)

  useEffect(() => {
    fetch('/api/promo-history?type=olivepick')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const handleInsightUpdate = useCallback((month: string, insight: PromoMonthlyInsight) => {
    setData(prev => prev?.map(m => m.month === month ? { ...m, insight } : m) ?? prev)
  }, [])

  const allCategories = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    for (const m of data)
      for (const p of m.products)
        if (p.category_name) set.add(p.category_name)
    return Array.from(set)
  }, [data])

  const hasFilter = !!(search.trim() || filterCategory || showOursOnly)

  const displayMonths = useMemo(() => {
    if (!data) return []
    return data.map(m => {
      let products = m.products
      if (showOursOnly) products = products.filter(p => p.is_ours)
      if (filterCategory) products = products.filter(p => p.category_name === filterCategory)
      if (search.trim()) {
        const q = search.toLowerCase()
        products = products.filter(p => p.goods_name.toLowerCase().includes(q))
      }
      const catMap = new Map<string, number>()
      for (const p of products)
        if (p.category_name) catMap.set(p.category_name, (catMap.get(p.category_name) ?? 0) + 1)
      const category_counts = Array.from(catMap.entries())
        .map(([category_name, count]) => ({ category_name, count }))
        .sort((a, b) => b.count - a.count)
      return { ...m, products, category_counts, our_count: products.filter(p => p.is_ours).length }
    }).filter(m => !hasFilter || m.products.length > 0)
  }, [data, search, filterCategory, showOursOnly, hasFilter])

  return (
    <div className="space-y-4">
      <div>
        <SectionDivider tag="올영픽" />
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-text-primary">올영픽 월별 이력</h2>
          <span className="text-sm text-text-tertiary">월별 기획 컨셉 및 입점 현황</span>
        </div>
      </div>

      {/* 필터 컨트롤 */}
      {!loading && data && data.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="상품명으로 검색..."
              className="text-sm border border-border rounded px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-accent flex-1 min-w-[180px] max-w-xs"
            />
            <button
              onClick={() => setShowOursOnly(v => !v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${
                showOursOnly
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-surface border-border text-text-secondary hover:border-accent hover:text-accent'
              }`}
            >
              자사만 보기
            </button>
            {hasFilter && (
              <span className="text-xs text-text-tertiary">
                {displayMonths.length}개월 / 전체 {data.length}개월
              </span>
            )}
          </div>

          {allCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterCategory(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterCategory === null
                    ? 'bg-accent text-white border-accent font-semibold'
                    : 'bg-surface border-border text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                전체
              </button>
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(prev => prev === cat ? null : cat)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    filterCategory === cat
                      ? 'bg-accent text-white border-accent font-semibold'
                      : 'bg-surface border-border text-text-secondary hover:border-accent hover:text-accent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-lg bg-border/40 animate-shimmer" />
          ))}
        </div>
      )}

      {!loading && data?.length === 0 && (
        <div className="border border-dashed border-border rounded-lg px-6 py-10 text-center">
          <p className="text-sm text-text-secondary">수집된 올영픽 데이터가 없습니다</p>
          <p className="text-xs text-text-tertiary mt-1">수집기가 실행되면 자동으로 표시됩니다</p>
        </div>
      )}

      {!loading && data && data.length > 0 && displayMonths.length === 0 && (
        <div className="border border-dashed border-border rounded-lg px-6 py-10 text-center">
          <p className="text-sm text-text-secondary">필터 조건에 맞는 월이 없습니다</p>
          <button
            onClick={() => { setSearch(''); setFilterCategory(null); setShowOursOnly(false) }}
            className="text-xs text-accent mt-2 hover:underline"
          >
            필터 초기화
          </button>
        </div>
      )}

      {!loading && data && displayMonths.length > 0 && (
        <div className="space-y-2">
          {displayMonths.map((m, i) => (
            <OlivepickMonthAccordion
              key={m.month}
              month={m}
              defaultOpen={i === 0}
              onInsightUpdate={handleInsightUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
