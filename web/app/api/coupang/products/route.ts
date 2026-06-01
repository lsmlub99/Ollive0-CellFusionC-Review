import { Pool } from 'pg'
import { NextResponse } from 'next/server'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 10000,
  options: '-c search_path=coupang',
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await pool.connect()
  try {
    const { rows } = await client.query(`
      SELECT product_id, product_name, review_count
      FROM products
      WHERE product_name IS NOT NULL
      ORDER BY review_count DESC NULLS LAST, product_name
      LIMIT 100
    `)
    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json([])
  } finally {
    client.release()
  }
}
