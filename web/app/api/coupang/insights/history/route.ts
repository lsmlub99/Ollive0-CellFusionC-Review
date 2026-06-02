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
  const productId = req.nextUrl.searchParams.get('productId') ?? ''
  const limit     = Math.min(20, parseInt(req.nextUrl.searchParams.get('limit') ?? '10'))

  const client = await pool.connect()
  try {
    const cond   = productId ? 'WHERE product_id = $1' : 'WHERE product_id IS NULL'
    const params = productId ? [productId] : []

    params.push(limit as unknown as string)
    const { rows } = await client.query(
      `SELECT id, product_id, product_name, review_count, content,
              to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS created_at
       FROM insight_history
       ${cond}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    )
    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json([])
  } finally {
    client.release()
  }
}
