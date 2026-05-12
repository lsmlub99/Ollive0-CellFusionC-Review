'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { TimeSeriesPoint } from '@/lib/types'

interface Props {
  data: TimeSeriesPoint[]
}

function formatMonth(m: string) {
  // "2024.03" → "24.03"
  return m.slice(2)
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl space-y-1">
      <p className="font-semibold text-gray-300">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'review_cnt' ? `리뷰 ${p.value.toLocaleString()}개` : `평점 ${p.value}점`}
        </p>
      ))}
    </div>
  )
}

export default function TimeSeriesChart({ data }: Props) {
  if (data.length === 0) return null

  // Show year label only for January
  const tickFormatter = (val: string) => val.endsWith('.01') ? val.slice(0, 4) : ''

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" />
            월별 리뷰 수
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-amber-400" />
            평균 평점
          </span>
        </div>
        <span className="text-2xs text-text-tertiary">{data[0]?.month} – {data[data.length - 1]?.month}</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval={0}
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar yAxisId="cnt" dataKey="review_cnt" fill="#10b981" opacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={24} />
          <Line yAxisId="score" dataKey="avg_score" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
