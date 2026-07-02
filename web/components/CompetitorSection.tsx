'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CompetitorSummary } from '@/lib/types'
import SectionDivider from '@/components/SectionDivider'

interface Props {
  summaries: CompetitorSummary[]
}

function formatDate(ts: string) {
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function CompetitorCard({ s }: { s: CompetitorSummary }) {
  const [open, setOpen] = useState(false)
  const bestRank = s.categories.length > 0
    ? s.categories.reduce((a, b) => a.rank < b.rank ? a : b)
    : null

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-border-subtle/40 transition-colors"
      >
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-sm font-medium text-text-primary truncate">{s.goods_name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            {bestRank && (
              <span className="text-xs text-red-500 font-semibold">{bestRank.name} {bestRank.rank}위</span>
            )}
            {s.categories.slice(1).map(c => (
              <span key={c.name} className="text-xs text-text-tertiary">{c.name} {c.rank}위</span>
            ))}
            {s.review_cnt > 0 && (
              <span className="text-2xs text-text-tertiary/60">리뷰 {s.review_cnt}개 분석</span>
            )}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border space-y-4 pt-3">
              <div>
                <p className="text-2xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">장점</p>
                <ul className="space-y-1.5">
                  {(s.pros || []).map((pro, i) => (
                    <li key={i} className="flex gap-2 text-xs text-text-primary">
                      <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-2xs font-semibold text-red-500 uppercase tracking-wider mb-2">단점</p>
                <ul className="space-y-1.5">
                  {(s.cons || []).map((con, i) => (
                    <li key={i} className="flex gap-2 text-xs text-text-primary">
                      <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>

              {s.customer_profile && (
                <div className="bg-accent-bg border border-accent-border border-t-2 border-t-accent/40 rounded-md px-3 py-2.5">
                  <p className="font-label text-[10px] tracking-[0.14em] uppercase text-accent-fg/70 mb-1">Customer Profile</p>
                  <p className="text-xs text-text-secondary">{s.customer_profile}</p>
                </div>
              )}

              <p className="text-2xs text-text-tertiary/60">AI 분석 {formatDate(s.generated_at)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CompetitorSection({ summaries }: Props) {
  return (
    <div className="space-y-4">
      <div className="mb-5">
        <SectionDivider tag="경쟁사 분석" />
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-text-primary">경쟁사 AI 분석</h2>
          {summaries.length > 0 && (
            <span className="text-sm text-text-tertiary">{summaries.length}개 상품</span>
          )}
        </div>
        <p className="text-xs text-text-tertiary mt-1">
          랭킹 상위 경쟁사 상품의 실구매 리뷰를 AI로 분석합니다
        </p>
      </div>

      {summaries.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg px-6 py-10 text-center space-y-2">
          <p className="text-sm text-text-secondary">아직 경쟁사 분석이 생성되지 않았어요</p>
          <p className="text-xs text-text-tertiary font-mono">
            python -m collector.competitor_pipeline
          </p>
          <p className="text-xs text-text-tertiary font-mono">
            python -m collector.summarizer --mode competitors
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {summaries.map(s => (
            <CompetitorCard key={s.goods_no} s={s} />
          ))}
        </div>
      )}
    </div>
  )
}
