'use client'

import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { TimeSeriesPoint } from '@/lib/types'

interface Props {
  data: TimeSeriesPoint[]
}

function toWeekString(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function weekToLabel(w: string): string {
  // "2026-W24" → "6/9"
  const [yearStr, wStr] = w.split('-W')
  const year = parseInt(yearStr)
  const weekNum = parseInt(wStr)
  const jan4 = new Date(year, 0, 4)
  const monday1 = new Date(jan4)
  monday1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const monday = new Date(monday1)
  monday.setDate(monday1.getDate() + (weekNum - 1) * 7)
  return `${monday.getMonth() + 1}/${monday.getDate()}`
}

function CustomTooltip({ active, payload, label, weekly }: any) {
  if (!active || !payload?.length) return null
  const map: Record<string, string> = {
    review_cnt: '리뷰 수',
    avg_score:  '평균 평점',
    pos_pct:    '긍정 비율',
    neg_pct:    '부정 비율',
  }
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl space-y-1">
      <p className="font-semibold text-gray-300">{weekly ? weekToLabel(label) + '주' : label}</p>
      {payload.map((p: any) => {
        const name = map[p.dataKey] ?? p.dataKey
        const val = p.dataKey === 'review_cnt'
          ? `${p.value.toLocaleString()}개`
          : p.dataKey === 'avg_score'
            ? `${p.value}점`
            : `${p.value}%`
        return <p key={p.dataKey} style={{ color: p.color }}>{name}: {val}</p>
      })}
    </div>
  )
}

export default function TimeSeriesChart({ data }: Props) {
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [weeklyData, setWeeklyData] = useState<TimeSeriesPoint[]>([])
  const [loading, setLoading] = useState(false)

  const defaultWeeks = () => {
    const to = toWeekString(new Date())
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 11 * 7)
    return { from: toWeekString(fromDate), to }
  }

  const [range, setRange] = useState(defaultWeeks)

  useEffect(() => {
    if (mode !== 'week') return
    setLoading(true)
    fetch(`/api/reviews/trends?from=${range.from}&to=${range.to}`)
      .then(r => r.json())
      .then(d => { setWeeklyData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mode, range.from, range.to])

  const chartData = mode === 'month' ? data : weeklyData
  if (data.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* 범례 + 모드 토글 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-md overflow-hidden border border-stone-200 text-xs">
            <button
              onClick={() => setMode('month')}
              className={`px-2.5 py-1 transition-colors ${mode === 'month' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}
            >월간</button>
            <button
              onClick={() => setMode('week')}
              className={`px-2.5 py-1 transition-colors ${mode === 'week' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}
            >주간</button>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-tertiary flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" />
              {mode === 'week' ? '주별' : '월별'} 리뷰 수
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-amber-400" />
              평균 평점
            </span>
          </div>
        </div>

        {/* 주간 범위 피커 */}
        {mode === 'week' && (
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <input
              type="week"
              value={range.from}
              max={range.to}
              onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
              className="border border-stone-200 rounded px-1.5 py-0.5 text-xs text-stone-700 focus:outline-none focus:border-stone-400"
            />
            <span>~</span>
            <input
              type="week"
              value={range.to}
              min={range.from}
              max={toWeekString(new Date())}
              onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
              className="border border-stone-200 rounded px-1.5 py-0.5 text-xs text-stone-700 focus:outline-none focus:border-stone-400"
            />
          </div>
        )}

        {mode === 'month' && (
          <span className="text-2xs text-text-tertiary">{data[0]?.month} – {data[data.length - 1]?.month}</span>
        )}
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-stone-400">불러오는 중...</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={mode === 'week' ? weekToLabel : (v => v.endsWith('.01') ? v.slice(0, 4) : '')}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={mode === 'week' ? 'preserveStartEnd' : 0}
            />
            <YAxis
              yAxisId="cnt"
              orientation="left"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <YAxis
              yAxisId="score"
              orientation="right"
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={20}
            />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} hide />
            <Tooltip content={<CustomTooltip weekly={mode === 'week'} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar yAxisId="cnt" dataKey="review_cnt" fill="#10b981" opacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={24} />
            <Line yAxisId="score" dataKey="avg_score" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line yAxisId="pct" dataKey="pos_pct" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Line yAxisId="pct" dataKey="neg_pct" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
