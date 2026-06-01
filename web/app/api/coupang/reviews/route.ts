import { Pool } from 'pg'
import { NextRequest, NextResponse } from 'next/server'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 10000,
  options: '-c search_path=coupang',
})

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page      = Math.max(0, parseInt(searchParams.get('page') ?? '0'))
  const productId = searchParams.get('productId') ?? ''
  const filter    = searchParams.get('filter') ?? 'all'
  const limit     = 20
  const offset    = page * limit

  const params: unknown[] = []

  let cond = ''
  if (productId) {
    params.push(productId)
    cond += ` AND r.product_id = $${params.length}`
  }
  if (filter === 'five')      cond += ' AND r.rating = 5'
  else if (filter === 'four_plus') cond += ' AND r.rating >= 4'
  else if (filter === 'negative')  cond += ' AND r.rating <= 2'

  params.push(limit)
  const limitIdx = params.length
  params.push(offset)
  const offsetIdx = params.length

  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT r.review_id, r.product_id, p.product_name, r.content,
              r.rating, r.helpful_count, r.purchased_option, r.created_at
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.product_id
       WHERE 1=1 ${cond}
       ORDER BY r.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    )

    const countParams = productId ? [productId] : []
    const countCond = productId ? 'AND r.product_id = $1' : ''
    const ratingCond =
      filter === 'five'      ? 'AND r.rating = 5'  :
      filter === 'four_plus' ? 'AND r.rating >= 4' :
      filter === 'negative'  ? 'AND r.rating <= 2' : ''

    const { rows: cr } = await client.query(
      `SELECT COUNT(*)::int AS total FROM reviews r WHERE 1=1 ${countCond} ${ratingCond}`,
      countParams
    )
    const total   = cr[0]?.total ?? 0
    const has_more = offset + rows.length < total

    return NextResponse.json({ reviews: rows, total, has_more })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ reviews: [], total: 0, has_more: false })
  } finally {
    client.release()
  }
}
