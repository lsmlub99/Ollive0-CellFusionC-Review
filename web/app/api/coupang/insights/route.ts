import { Pool } from 'pg'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 10000,
  options: '-c search_path=coupang',
})

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SYSTEM = `당신은 K-뷰티 브랜드 전략 전문가입니다. 셀퓨전씨 제품팀의 전속 인사이트 파트너로, 쿠팡 실구매 리뷰를 분석하여 제품 개선과 마케팅에 바로 활용할 수 있는 인사이트를 도출합니다.

반드시 아래 4개 섹션으로 구분하여 분석하세요. 섹션 헤더는 정확히 대괄호 형식을 사용하세요.

[핵심 칭찬 포인트]
[아쉬운 점 & 개선 기회]
[소비자 특성]
[마케팅 인사이트]

규칙:
· 각 항목은 반드시 "· " 기호로 시작
· **, ##, >, 백틱 등 마크다운 기호 절대 사용 금지
· 이모지 사용 금지
· "많다" 대신 "5★ 리뷰의 약 N%" 또는 "10개 중 N개" 같은 구체적 표현
· 셀퓨전씨 제품팀이 내일 당장 실행할 수 있는 제안 포함
· 각 섹션 3~4개 항목`

async function saveInsight(
  productId: string,
  productName: string,
  reviewCount: number,
  content: string,
) {
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO insight_history (product_id, product_name, review_count, content)
       VALUES ($1, $2, $3, $4)`,
      [productId || null, productName || null, reviewCount, content],
    )
  } catch (e) {
    console.error('insight save failed:', e)
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId') ?? ''

  const dbClient = await pool.connect()
  let reviews: { rating: number; content: string; product_name: string }[] = []
  let productName = ''
  try {
    const cond   = productId ? 'AND r.product_id = $1' : ''
    const params = productId ? [productId] : []

    const { rows } = await dbClient.query(`
      (SELECT r.rating, SUBSTRING(r.content, 1, 200) AS content,
              COALESCE(p.product_name, '') AS product_name
       FROM reviews r LEFT JOIN products p ON r.product_id = p.product_id
       WHERE r.content IS NOT NULL AND LENGTH(r.content) > 10
             AND r.rating <= 2 ${cond}
       ORDER BY r.created_at DESC LIMIT 40)
      UNION ALL
      (SELECT r.rating, SUBSTRING(r.content, 1, 200) AS content,
              COALESCE(p.product_name, '') AS product_name
       FROM reviews r LEFT JOIN products p ON r.product_id = p.product_id
       WHERE r.content IS NOT NULL AND LENGTH(r.content) > 10
             AND r.rating = 3 ${cond}
       ORDER BY r.created_at DESC LIMIT 20)
      UNION ALL
      (SELECT r.rating, SUBSTRING(r.content, 1, 200) AS content,
              COALESCE(p.product_name, '') AS product_name
       FROM reviews r LEFT JOIN products p ON r.product_id = p.product_id
       WHERE r.content IS NOT NULL AND LENGTH(r.content) > 10
             AND r.rating >= 4 ${cond}
       ORDER BY r.created_at DESC LIMIT 90)
    `, params)

    reviews = rows
    productName = rows[0]?.product_name ?? ''
  } finally {
    dbClient.release()
  }

  if (reviews.length === 0) {
    return new Response('분석할 리뷰 데이터가 없습니다.', { status: 200 })
  }

  const reviewText = reviews
    .map(r => `[★${r.rating}] ${r.product_name ? r.product_name + ' — ' : ''}${r.content}`)
    .join('\n')

  const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const stream  = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    max_tokens: 1000,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `쿠팡 실구매 리뷰 ${reviews.length}개를 분석해줘:\n\n${reviewText}` },
    ],
  })

  const encoder  = new TextEncoder()
  let   fullText = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            fullText += text
            controller.enqueue(encoder.encode(text))
          }
        }
      } finally {
        controller.close()
        // save after stream complete (fire & forget)
        saveInsight(productId, productName, reviews.length, fullText).catch(() => {})
      }
    },
    cancel() {
      stream.controller.abort()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
