import { NextRequest, NextResponse } from 'next/server'
import { getTimeSeriesWeekly } from '@/lib/db'

// "2026-W24" → Monday date string "2026-06-09"
function weekToMonday(week: string): string {
  const [yearStr, wStr] = week.split('-W')
  const year = parseInt(yearStr)
  const weekNum = parseInt(wStr)
  const jan4 = new Date(year, 0, 4)
  const monday1 = new Date(jan4)
  monday1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const monday = new Date(monday1)
  monday.setDate(monday1.getDate() + (weekNum - 1) * 7)
  return monday.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? ''
  const to   = req.nextUrl.searchParams.get('to')   ?? ''
  if (!from || !to) return NextResponse.json({ error: 'from/to required' }, { status: 400 })

  const fromDate = weekToMonday(from)
  const toMon    = weekToMonday(to)
  const toDate   = new Date(toMon)
  toDate.setDate(toDate.getDate() + 7)
  const toDateStr = toDate.toISOString().split('T')[0]

  const data = await getTimeSeriesWeekly(fromDate, toDateStr)
  return NextResponse.json(data)
}
