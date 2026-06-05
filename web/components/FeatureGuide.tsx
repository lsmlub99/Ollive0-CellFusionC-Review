'use client'

import { useState } from 'react'

const SECTIONS = [
  {
    platform: '올리브영',
    color: 'text-emerald-600',
    dot: 'bg-emerald-500',
    tabs: [
      {
        tab: '오늘 현황',
        items: [
          'AI가 랭킹·리뷰·프로모션을 종합해 오늘 마케터가 즉시 파악해야 할 것을 자동 요약',
          '부정 리뷰 전주 대비 50% 이상 급증 상품 즉시 경고',
          '올영픽·오늘의 특가 입점 여부 확인',
          '시간대별 자사 순위 타임라인 (매 정시 수집, N회 측정 표시)',
        ],
      },
      {
        tab: '리뷰 분석',
        items: [
          '신제품 일평균 리뷰 속도·긍/부정 비율',
          '전체 긍정·부정 키워드 Top 8 + 피부 타입 분포',
          '상품별 불만 키워드·샘플 리뷰',
          'AI 리뷰 인사이트 — 제품팀 액션 포인트 도출',
        ],
      },
      {
        tab: '시장 랭킹',
        items: [
          '카테고리 8개 Top 100 순위 (전일 대비 변동 포함)',
          '급상승·신규 진입 상품 자동 감지',
          'AI 시장 인사이트 — 경쟁사 전략 해석',
          '자사만 보기 필터',
        ],
      },
      {
        tab: '올영픽 / 오특',
        items: [
          '월별 올영픽 큐레이션 AI 컨셉 태그·기획 요약',
          '자사 대응 액션 포인트 자동 생성',
          '오늘의 특가 현황 및 자사 포함 여부',
        ],
      },
      {
        tab: '이력',
        items: [
          '날짜별 AI 인사이트 스냅샷 보관',
          '과거 분석과 현재 비교 가능',
        ],
      },
    ],
  },
  {
    platform: '쿠팡',
    color: 'text-orange-500',
    dot: 'bg-orange-400',
    tabs: [
      {
        tab: 'KPI 현황',
        items: [
          '평균 평점·총 리뷰·7일 신규 리뷰·부정 비율 한눈에',
          '부정 비율 15% 이상이면 빨간 경고 표시',
        ],
      },
      {
        tab: '순위 · 리뷰',
        items: [
          '검색순위·카테고리 베스트셀러 자사 노출 현황',
          '실구매 리뷰 내용 — 칭찬·불만·소비자 특성',
          'AI 인사이트 — 즉시 조치 항목 우선 표시',
        ],
      },
    ],
  },
  {
    platform: '네이버',
    color: 'text-green-600',
    dot: 'bg-green-500',
    tabs: [
      {
        tab: '트렌드',
        items: [
          'DataLab 키워드 검색지수 최근 8주 추이',
          '계절·이벤트 수요 변화 파악',
        ],
      },
      {
        tab: '검색 노출',
        items: [
          '자사 상품 × 키워드 매트릭스 — 어디서 노출되고 어디서 빠지는지',
          '브랜드 키워드 자동 필터링 (경쟁 키워드만 분석)',
          '미노출 키워드 빨간 표시',
        ],
      },
      {
        tab: '경쟁사 · AI',
        items: [
          '카테고리별 경쟁사 상품·가격 분포',
          'AI 시장 분석 인사이트 — 액션 제안·트렌드 시그널·긴급도 배지',
        ],
      },
    ],
  },
  {
    platform: 'AI 챗봇',
    color: 'text-violet-500',
    dot: 'bg-violet-400',
    tabs: [
      {
        tab: '사용법',
        items: [
          '화면 오른쪽 하단 채팅 버튼으로 열기',
          '세 플랫폼 데이터에 자연어로 질문 가능',
          '"쿠팡이랑 올리브영 비교해줘" 같은 크로스 플랫폼 질문도 지원',
          '실시간 스트리밍 응답 — 첫 글자부터 즉시 표시',
        ],
      },
    ],
  },
]

export default function FeatureGuide() {
  const [openSection, setOpenSection] = useState<string | null>('올리브영')

  return (
    <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
      <div className="mb-4">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-tertiary">
          기능 안내
        </p>
        <p className="text-[11px] text-text-tertiary/70 mt-0.5 leading-relaxed">
          탭별 주요 기능을 확인하세요
        </p>
      </div>

      <div className="space-y-1.5">
        {SECTIONS.map(sec => (
          <div key={sec.platform} className="border border-border rounded-lg overflow-hidden">
            {/* 섹션 헤더 */}
            <button
              onClick={() => setOpenSection(v => v === sec.platform ? null : sec.platform)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${sec.dot} shrink-0`} />
                <span className={`text-xs font-semibold ${sec.color}`}>{sec.platform}</span>
              </div>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                className={`transition-transform text-text-tertiary ${openSection === sec.platform ? 'rotate-180' : ''}`}
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* 탭별 기능 목록 */}
            {openSection === sec.platform && (
              <div className="border-t border-border bg-surface/50 px-3 py-2.5 space-y-3">
                {sec.tabs.map(t => (
                  <div key={t.tab}>
                    <p className="text-[11px] font-semibold text-text-secondary mb-1">{t.tab}</p>
                    <ul className="space-y-1">
                      {t.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-text-tertiary shrink-0 mt-0.5 text-[10px]">·</span>
                          <span className="text-[11px] text-text-tertiary leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] text-text-tertiary/50 leading-relaxed">
        매일 오전 6시 자동 수집
        <br />문의: AI 챗봇에 질문하세요
      </p>
    </div>
  )
}
