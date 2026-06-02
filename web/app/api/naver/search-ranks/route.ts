import { Pool } from 'pg'
import { NextResponse } from 'next/server'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 10000,
  options: '-c search_path=naver',
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await pool.connect()
  try {
    // 카테고리 경쟁 순위: 일반 키워드("선크림" 등) 검색에서 우리 순위
    const { rows: catRows } = await client.query(`
      WITH latest AS (
        SELECT MAX(rank_date) AS rd FROM search_ranks WHERE query_type = 'category'
      ),
      prev AS (
        SELECT MAX(rank_date) AS rd FROM search_ranks
        WHERE query_type = 'category' AND rank_date < (SELECT rd FROM latest)
      )
      SELECT
        c.keyword, c.rank_position, c.product_title, c.mall_name,
        c.price, c.link, c.is_ours, c.rank_date::text,
        p.rank_position AS prev_rank,
        (p.rank_position - c.rank_position)::int AS delta
      FROM search_ranks c
      LEFT JOIN search_ranks p
        ON p.keyword = c.keyword
       AND p.product_title = c.product_title
       AND p.rank_date = (SELECT rd FROM prev)
       AND p.query_type = 'category'
      WHERE c.rank_date = (SELECT rd FROM latest)
        AND c.query_type = 'category'
      ORDER BY c.keyword, c.rank_position
    `)

    // 자사 채널 분포: 제품명 검색("셀퓨전씨 더마릴리프 선크림" 등) 결과 채널별 집계
    const { rows: brandRows } = await client.query(`
      SELECT
        keyword,
        COUNT(*)::int AS channel_count,
        MIN(price) FILTER (WHERE price > 0) AS price_min,
        MAX(price) FILTER (WHERE price > 0) AS price_max,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE price > 0)::int AS price_median,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'mall_name', mall_name,
            'rank_position', rank_position,
            'price', price,
            'link', link
          ) ORDER BY rank_position
        ) AS channels,
        MAX(rank_date)::text AS rank_date
      FROM search_ranks
      WHERE rank_date = (SELECT MAX(rank_date) FROM search_ranks WHERE query_type = 'brand')
        AND query_type = 'brand'
      GROUP BY keyword
      ORDER BY keyword
    `)

    return NextResponse.json({ category: catRows, brand: brandRows })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ category: [], brand: [] })
  } finally {
    client.release()
  }
}
