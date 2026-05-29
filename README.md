<div align="center">

# Oliveyoung Insight Dashboard

**올리브영 브랜드 모니터링 자동화 시스템**

리뷰 · 카테고리 순위 · 프로모션 데이터를 매일 자동 수집하고
AI가 브랜드 마케터에게 즉시 활용 가능한 인사이트를 제공합니다.

[![Live](https://img.shields.io/badge/Live_Demo-oliveyoung--review.vercel.app-22c55e?style=for-the-badge)](https://oliveyoung-review.vercel.app)

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel)

</div>

---

## What I Built

뷰티 브랜드 마케터가 매일 아침 올리브영을 직접 들어가 순위를 확인하고, 리뷰를 읽고, 경쟁사를 체크하는 반복 업무를 자동화한 프로젝트입니다.

수집부터 분석까지 전 파이프라인을 혼자 설계하고 구현했으며, 현재 실제 브랜드 운영팀에서 사용 중입니다.

---

## Architecture

```
Windows Server (Task Scheduler)
  ├── 리뷰 수집    06:00 / 16:00
  ├── 순위 수집    매시 정각 (변화 감지 시만 저장)
  └── 프로모 수집  08:00
          │
          ▼ psycopg2
  Supabase PostgreSQL
          │
          ▼ ISR + On-demand Revalidation
  Next.js 15 (Vercel)
    ├── Claude API   → 대시보드 AI 분석 / 데일리 브리핑
    └── GPT-4o-mini  → 인터랙티브 챗봇
```

---

## Key Features

**오늘 현황**
매일 아침 AI가 전일 대비 주요 변동을 자동 요약합니다. 부정 리뷰가 급증한 상품은 즉시 알림으로 감지되고, 시간대별 순위 타임라인으로 하루 동안의 흐름을 한눈에 볼 수 있습니다.

**시장 순위**
올리브영 전 카테고리 Top 100을 매시간 수집해 자사 제품의 포지션과 경쟁사 움직임을 추적합니다. AI가 단순 순위 나열이 아닌 "왜 이 시점에 이 브랜드가 올랐는지"를 해석합니다.

**리뷰 분석**
실구매 리뷰에서 긍/부정 키워드를 추출하고 피부 타입별 분포를 시각화합니다. Claude가 수천 건의 리뷰를 읽고 제품팀이 다음 분기 액션을 결정할 수 있는 인사이트를 생성합니다.

**AI 챗봇**
GPT-4o-mini 기반 챗봇이 DB에 직접 연결되어 "선케어 시장에서 우리 포지션 어때?", "부정 리뷰 급증한 상품 있어?" 같은 자연어 질문에 데이터를 조회해 답합니다.

---

## Technical Challenges

**봇 탐지 우회**
올리브영은 반복 요청에 HTTP 403을 반환합니다. `curl_cffi`로 Chrome 브라우저 fingerprint를 흉내 내고 요청 간격을 랜덤화해 안정적인 수집을 구현했습니다.

**UTC / KST 불일치**
Vercel과 Supabase는 UTC 기준, Windows 수집기는 KST 기준으로 동작합니다. `rank_hour`를 UTC로 통일해 저장하고, 프론트엔드에서 `(utcHour + 9) % 24`로 변환해 표시합니다. 이 불일치를 모르면 한국 시간 오전 9시 이전에 "어제 분석"이 그대로 노출되는 버그가 발생합니다.

**중복 데이터 제거**
올리브영 랭킹은 약 3시간 주기로 갱신되지만 수집기는 매시간 실행됩니다. 신규 수집 데이터를 직전 스냅샷과 비교해 변화가 없으면 저장을 스킵, 불필요한 데이터를 약 66% 절감했습니다.

**AI 응답 캐싱**
Claude API는 응답 생성에 수 초가 걸려 매 요청마다 호출하면 페이지 로딩이 느려집니다. 분석 결과를 DB에 KST 날짜 기준으로 캐싱하고, 수집기가 완료될 때마다 Vercel ISR 캐시를 On-demand로 초기화하는 방식으로 최신성과 속도를 모두 확보했습니다.

---

## Stack

| 분류 | 기술 |
|---|---|
| 수집기 | Python 3.12, curl_cffi, BeautifulSoup4, psycopg2 |
| 데이터베이스 | Supabase PostgreSQL (서울 리전) |
| 프론트엔드 | Next.js 15 App Router, React 19, TypeScript |
| 스타일링 | Tailwind CSS, Framer Motion |
| 차트 | Recharts |
| 배포 | Vercel (ISR + On-demand Revalidation) |
| 스케줄러 | Windows Task Scheduler |
| AI | Anthropic Claude (분석), OpenAI GPT-4o-mini (챗봇) |

---

## Project Structure

```
├── collector/
│   ├── pipeline.py          # 리뷰 수집
│   ├── rank_collector.py    # 카테고리 순위 수집 (변화 감지 포함)
│   └── promo_collector.py   # 올영픽 · 오늘의 특가 수집
├── web/
│   ├── app/
│   │   ├── page.tsx         # 메인 대시보드 (Server Component)
│   │   └── api/chat/        # GPT-4o-mini 챗봇 API
│   ├── components/          # UI 컴포넌트
│   └── lib/
│       ├── db.ts            # DB 쿼리 함수
│       └── ai.ts            # Claude AI 호출 + 캐싱
└── db/
    └── schema.py            # DB 스키마
```

---

<div align="center">
  <sub>Built with Python · Next.js · Supabase · Vercel · Claude · GPT-4o-mini</sub>
</div>
