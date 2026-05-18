import Anthropic from '@anthropic-ai/sdk'
import type { MarketCategoryData, Insights, ProductNegativeData } from './types'
import { pool } from './db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 6시 수집 → 'am', 16시 수집 → 'pm'
function getSlot(): 'am' | 'pm' {
  return new Date().getHours() < 13 ? 'am' : 'pm'
}

// ──────────────────────────────────────────
// 1. 시장 인사이트 (랭킹 기반)
// ──────────────────────────────────────────

function buildMarketPrompt(data: MarketCategoryData[]): string {
  // 카테고리별 1위
  const leaders = data
    .filter(c => c.category_name !== '전체')
    .map(c => `${c.category_name} 1위: ${c.entries[0]?.goods_name ?? '-'}`)

  // 급상승 (delta >= 3) 전체
  const risers = data
    .flatMap(c => c.entries
      .filter(e => e.delta != null && e.delta >= 3)
      .map(e => ({ ...e, cat: c.category_name })))
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .map(e => `[${e.cat}] ${e.rank_position}위 ${e.goods_name}(+${e.delta})`)

  // 신규 TOP20 진입 상품
  const newEntries = data
    .flatMap(c => c.entries
      .filter(e => e.prev_rank == null && e.rank_position <= 20)
      .map(e => ({ ...e, cat: c.category_name })))
    .map(e => `[${e.cat}] ${e.rank_position}위 ${e.goods_name}(신규)`)

  // 급하락 (delta <= -5)
  const fallers = data
    .flatMap(c => c.entries
      .filter(e => e.delta != null && e.delta <= -5)
      .map(e => ({ ...e, cat: c.category_name })))
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 5)
    .map(e => `[${e.cat}] ${e.rank_position}위 ${e.goods_name}(${e.delta})`)

  // 자사 현황
  const ours = data.flatMap(c =>
    c.entries.filter(e => e.is_ours)
      .map(e => `${c.category_name} ${e.rank_position}위${e.delta != null ? `(${e.delta > 0 ? '+' : ''}${e.delta})` : ''}`))

  return `[올리브영 베스트100 랭킹 현황 - 셀퓨전씨 마케터용]

카테고리 1위:
${leaders.join('\n')}

급상승 상품 (전일 대비 3위↑):
${risers.length ? risers.join('\n') : '없음'}

신규 TOP20 진입:
${newEntries.length ? newEntries.join('\n') : '없음'}

급하락 상품:
${fallers.length ? fallers.join('\n') : '없음'}

셀퓨전씨 포지션:
${ours.length ? ours.join(', ') : 'TOP100 없음'}

위 데이터를 바탕으로 셀퓨전씨 마케터에게 필요한 시장 인사이트를 작성하라.
- 주목할 시장 트렌드 (급상승/신규진입 상품 중심)
- 셀퓨전씨 포지션 평가 및 경쟁 위협
- 단기 대응 제안
bullet point 5~7개, 수치 포함, 한국어만`
}

export async function generateMarketInsight(data: MarketCategoryData[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY || data.length === 0) return ''

  const todayStr = new Date().toLocaleDateString('sv-SE')
  const slot = getSlot()

  try {
    const cached = await pool.query(
      'SELECT insight_text FROM market_insights WHERE insight_date = $1 AND slot = $2',
      [todayStr, slot]
    )
    if (cached.rows[0]?.insight_text) return cached.rows[0].insight_text
  } catch { /* 테이블 없으면 skip */ }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: buildMarketPrompt(data) }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!text) return ''

    await pool.query(`
      INSERT INTO market_insights (insight_date, slot, insight_text)
      VALUES ($1, $2, $3)
      ON CONFLICT (insight_date, slot) DO UPDATE
      SET insight_text = EXCLUDED.insight_text, generated_at = NOW()
    `, [todayStr, slot, text])

    return text
  } catch (e) {
    console.error('Market insight generation failed:', e)
    return ''
  }
}

// ──────────────────────────────────────────
// 2. 리뷰 인사이트 (자사 상품 개선 분석)
// ──────────────────────────────────────────

function buildReviewPrompt(insights: Insights, negativeData: ProductNegativeData[]): string {
  const posKw = insights.positive_keywords.slice(0, 15).map(k => `${k.word}(${k.cnt})`).join(', ')
  const negKw = insights.negative_keywords.slice(0, 10).map(k => `${k.word}(${k.cnt})`).join(', ')

  const productIssues = negativeData
    .sort((a, b) => b.neg_count - a.neg_count)
    .slice(0, 8)
    .map(p => {
      const kw = p.keywords.slice(0, 5).map(k => k.word).join(', ')
      const sample = p.samples[0]?.content?.slice(0, 80) ?? ''
      return `• ${p.goods_name}: 불만 ${p.neg_count}건 [키워드: ${kw}] "${sample}"`
    })

  return `[셀퓨전씨 올리브영 실구매 리뷰 분석 데이터]

전체 긍정 키워드 (리뷰 빈도순):
${posKw}

전체 부정 키워드:
${negKw}

상품별 불만 상세:
${productIssues.join('\n')}

위 실구매 리뷰 데이터를 바탕으로 셀퓨전씨 제품 담당자에게 필요한 인사이트를 작성하라.
- 고객이 반복적으로 언급하는 개선 요구사항
- 불만이 집중된 상품과 구체적 원인
- 긍정 키워드 기반 강점 유지 전략
- 리뷰 데이터 기반 신제품/리뉴얼 방향 제안
bullet point 5~7개, 구체적 수치와 키워드 인용, 한국어만`
}

export async function generateReviewInsight(
  insights: Insights,
  negativeData: ProductNegativeData[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY || insights.total_reviews === 0) return ''

  const todayStr = new Date().toLocaleDateString('sv-SE')

  try {
    const cached = await pool.query(
      'SELECT insight_text FROM review_insights WHERE insight_date = $1',
      [todayStr]
    )
    if (cached.rows[0]?.insight_text) return cached.rows[0].insight_text
  } catch { /* 테이블 없으면 skip */ }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: buildReviewPrompt(insights, negativeData) }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!text) return ''

    await pool.query(`
      INSERT INTO review_insights (insight_date, insight_text)
      VALUES ($1, $2)
      ON CONFLICT (insight_date) DO UPDATE
      SET insight_text = EXCLUDED.insight_text, generated_at = NOW()
    `, [todayStr, text])

    return text
  } catch (e) {
    console.error('Review insight generation failed:', e)
    return ''
  }
}
