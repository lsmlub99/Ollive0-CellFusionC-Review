import { Pool } from 'pg'
import { NextResponse } from 'next/server'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 10000,
  options: '-c search_path=coupang',
})

export async function GET() {
  const client = await pool.connect()
  try {
    const { rows } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM reviews)::int           AS total_reviews,
        (SELECT COUNT(*) FROM products)::int          AS total_products,
        ROUND(AVG(rating)::numeric, 2)::float         AS avg_rating,
        MAX(collected_at)                             AS last_updated,
        (SELECT COUNT(*) FROM reviews
         WHERE collected_at >= NOW() - INTERVAL '7 days')::int AS new_reviews_7d,
        ROUND(
          SUM(CASE WHEN rating <= 3 THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )::float                                      AS negative_ratio
      FROM reviews
    `)
    return NextResponse.json(rows[0] ?? {
      total_reviews: 0, total_products: 0, avg_rating: 0, last_updated: null,
      new_reviews_7d: 0, negative_ratio: 0,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({
      total_reviews: 0, total_products: 0, avg_rating: 0, last_updated: null,
      new_reviews_7d: 0, negative_ratio: 0,
    })
  } finally {
    client.release()
  }
}
