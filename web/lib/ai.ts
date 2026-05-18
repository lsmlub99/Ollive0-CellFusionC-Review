import Anthropic from '@anthropic-ai/sdk'
import type { MarketCategoryData } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateMarketInsight(data: MarketCategoryData[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY || data.length === 0) return ''

  // 프롬프트에 넣을 요약 데이터 구성
  const summary = data.map(cat => {
    const top5 = cat.entries.slice(0, 5).map(e =>
      `  ${e.rank_position}위: ${e.goods_name || e.goods_no}${e.delta != null ? ` (전일비 ${e.delta > 0 ? '+' : ''}${e.delta})` : ' (신규)'}`
    ).join('\n')

    const risers = cat.entries
      .filter(e => e.delta != null && e.delta >= 3)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
      .slice(0, 3)
      .map(e => `  ${e.goods_name || e.goods_no}: +${e.delta}위 (${e.rank_position}위)`)
      .join('\n')

    const fallers = cat.entries
      .filter(e => e.delta != null && e.delta <= -3)
      .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
      .slice(0, 2)
      .map(e => `  ${e.goods_name || e.goods_no}: ${e.delta}위 (${e.rank_position}위)`)
      .join('\n')

    const ours = cat.entries.filter(e => e.is_ours)
      .map(e => `  ${e.rank_position}위${e.delta != null ? ` (전일비 ${e.delta > 0 ? '+' : ''}${e.delta})` : ''}`)
      .join(', ')

    return [
      `[${cat.category_name}]`,
      `TOP 5:\n${top5}`,
      risers ? `급상승:\n${risers}` : null,
      fallers ? `급하락:\n${fallers}` : null,
      ours ? `셀퓨전씨: ${ours}` : '셀퓨전씨: 해당 카테고리 TOP 100 없음',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const hasDelta = data.some(cat => cat.entries.some(e => e.delta != null))

  const prompt = `당신은 뷰티/스킨케어 시장 분석 전문가입니다. 오늘의 올리브영 카테고리 베스트 100 랭킹 데이터를 분석해주세요.

브랜드: 셀퓨전씨 (CellFusionC) — 주로 선케어 카테고리 경쟁 중

오늘의 랭킹 데이터:
${summary}

${hasDelta ? '전일 대비 순위 변동이 포함된 데이터입니다.' : '오늘이 첫 수집일이라 전일 비교 데이터가 없습니다.'}

다음 형식으로 분석해주세요:
- 3~5개의 핵심 인사이트를 bullet point로
- 각 항목은 한 문장, 50자 이내
- 셀퓨전씨에게 중요한 경쟁 동향 반드시 포함
- 수치(순위, 변동폭) 반드시 언급
- 마케팅 담당자가 즉시 액션할 수 있는 내용으로
- 한국어로만 작성`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return text.trim()
  } catch (e) {
    console.error('AI insight generation failed:', e)
    return ''
  }
}
