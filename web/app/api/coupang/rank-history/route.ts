import { Pool } from 'pg'
import { NextResponse } from 'next/server'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 10000,
  options: '-c search_path=coupang',
})

export const dynamic = 'force-dynamic'

export interface RankHistoryEntry {
  product_id: string
  product_name: string
  is_ours: boolean
  category_name: string
  history: { date: string; rank: number }[]
}

export async function GET() {
  const client = await pool.connect()
  try {
    // Daily best rank per product per category (last 60 days)
    const { rows } = await client.query(`
      SELECT
        category_name,
        product_id,
        product_name,
        is_ours,
        rank_date::text AS date,
        MIN(rank_position)::int AS rank
      FROM category_rankings
      WHERE rank_date >= CURRENT_DATE - INTERVAL '60 days'
      GROUP BY category_name, product_id, product_name, is_ours, rank_date
      ORDER BY category_name, rank_date, rank
    `)

    // Group into { [category]: RankHistoryEntry[] }
    const byCategory: Record<string, Record<string, RankHistoryEntry>> = {}

    for (const row of rows) {
      const cat = row.category_name as string
      const pid = row.product_id  as string

      if (!byCategory[cat]) byCategory[cat] = {}
      if (!byCategory[cat][pid]) {
        byCategory[cat][pid] = {
          product_id:   pid,
          product_name: row.product_name,
          is_ours:      row.is_ours,
          category_name: cat,
          history:      [],
        }
      }
      byCategory[cat][pid].history.push({ date: row.date, rank: row.rank })
    }

    // Flatten: each category → array sorted by latest rank (ours first)
    const result: Record<string, RankHistoryEntry[]> = {}
    for (const [cat, productMap] of Object.entries(byCategory)) {
      const entries = Object.values(productMap)
      entries.sort((a, b) => {
        // ours first, then by latest rank
        if (a.is_ours !== b.is_ours) return a.is_ours ? -1 : 1
        const aLast = a.history.at(-1)?.rank ?? 999
        const bLast = b.history.at(-1)?.rank ?? 999
        return aLast - bLast
      })
      result[cat] = entries
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({})
  } finally {
    client.release()
  }
}
