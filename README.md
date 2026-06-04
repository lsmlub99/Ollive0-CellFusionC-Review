<div align="center">

# Oliveyoung Insight Dashboard

**셀퓨전씨 멀티플랫폼 브랜드 모니터링 자동화 시스템**

올리브영 · 쿠팡 · 네이버 세 플랫폼의 데이터를 자동 수집하고,<br/>
AI가 매일 아침 즉시 활용 가능한 전략 인사이트를 생성합니다.

[![Live Demo](https://img.shields.io/badge/Live_Demo-oliveyoung--review.vercel.app-22c55e?style=for-the-badge&logo=vercel)](https://oliveyoung-review.vercel.app)

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel)
![Claude](https://img.shields.io/badge/Claude_Sonnet_4.6-Anthropic-D97706?style=flat-square)

</div>

---

## What I Built

뷰티 브랜드 마케터가 매일 아침 올리브영·쿠팡·네이버를 직접 들어가 순위를 확인하고, 리뷰를 읽고, 경쟁사를 체크하는 반복 업무를 자동화한 프로젝트입니다.

데이터 수집부터 AI 분석, 웹 대시보드 배포, MCP 서버 연동까지 전 파이프라인을 설계하고 구현했으며, 현재 실제 브랜드 운영팀에서 사용 중입니다.

---

## Architecture

```
Windows Server (Task Scheduler)
  ├── 올리브영 리뷰 수집    06:00 / 16:00   (BeautifulSoup + curl_cffi)
  ├── 올리브영 순위 수집    매시 정각        (변화 감지 시만 저장)
  ├── 올리브영 프로모 수집  08:00
  ├── 쿠팡 리뷰·순위 수집   06:00 / 18:00
  └── 네이버 트렌드·검색 수집 06:00
          │
          ▼  psycopg2
  Supabase PostgreSQL (서울 리전)
    ├── oliveyoung 스키마   (리뷰, 순위, 프로모, 상품)
    ├── coupang 스키마      (리뷰, 순위, 상품)
    └── naver 스키마        (트렌드, 검색순위, 시장)
          │
          ▼  ISR + On-demand Revalidation
  Next.js 15 App Router (Vercel)
    ├── 올리브영 대시보드   리뷰·순위·프로모·AI 인사이트
    ├── 쿠팡 Beta           KPI·리뷰·검색순위·AI 인사이트
    ├── 네이버 Beta         검색 트렌드·노출 순위·경쟁사 시장
    └── Claude Sonnet 4.6  대시보드 AI 분석 + 인터랙티브 챗봇
          │
          ▼  MCP (Model Context Protocol)
  Claude Desktop / 외부 AI 클라이언트
```

---

## Key Features

### 오늘 현황 (올리브영)
매일 아침 AI가 랭킹·리뷰·프로모션 데이터를 종합해 "오늘 마케터가 10초 안에 파악해야 할 것"을 자동 요약합니다. 부정 리뷰가 전주 대비 50% 이상 급증한 상품은 즉시 경고로 감지되고, 시간대별 순위 타임라인으로 하루 동안의 흐름을 한눈에 확인할 수 있습니다.

### 쿠팡 Beta
수집된 실구매 리뷰의 평점·부정 비율·신규 리뷰 속도를 KPI 카드로 집약합니다. 검색순위와 카테고리 베스트셀러 노출 현황을 추적하며, Claude가 소비자 반응을 핵심 칭찬·아쉬운 점·마케팅 인사이트로 구조화합니다.

### 네이버 Beta
DataLab 검색 트렌드(8주 추이), 쇼핑 키워드별 검색 노출 순위, 경쟁사 가격 분포를 한 화면에 제공합니다. 자사 상품 × 검색 키워드 매트릭스로 "어떤 키워드에서 노출되는지, 어디서 빠지는지"를 즉시 파악할 수 있습니다. 브랜드 전용 키워드(자사 상품 점유율 80% 이상)를 자동 필터링해 경쟁 키워드만 분석 대상으로 남깁니다.

### AI 챗봇 (멀티플랫폼)
Claude Sonnet 4.6 기반 챗봇이 세 플랫폼 DB에 모두 연결됩니다. 현재 보고 있는 탭에 관계없이 "쿠팡이랑 올리브영 비교해줘" 같은 크로스 플랫폼 질문도 처리하며, 도구 호출 결과를 스트리밍으로 반환해 첫 글자부터 즉시 표시됩니다.

- 16개 도구 (올리브영 8 · 쿠팡 4 · 네이버 4) 항상 전체 제공
- 병렬 도구 실행: `Promise.all()`로 다중 DB 조회 동시 처리
- 프롬프트 캐싱: 시스템 프롬프트 + 도구 정의 5분 캐시 (입력 토큰 90% 절감)
- DB 결과 인메모리 TTL 캐시 (2~10분) — 반복 질문 즉시 응답

### MCP 서버
`/api/mcp` 엔드포인트가 Model Context Protocol을 구현합니다. Claude Desktop 등 MCP 호환 클라이언트를 연결하면 대시보드 없이 자연어로 DB를 직접 조회할 수 있습니다.

### 올영픽 / 오늘의 특가
월별 올영픽 큐레이션과 오늘의 특가 상품을 자동 수집합니다. Claude가 이달 기획 컨셉 태그, 프로모션 방향 요약, 자사 대응 액션 포인트를 구조화해 제공합니다.

---

## Technical Challenges

### 안정적인 데이터 수집 환경 구성
일반적인 HTTP 클라이언트로는 상용 이커머스 플랫폼의 자동 수집 방지 정책에 의해 정상적인 응답을 받기 어렵습니다. `curl_cffi`를 활용해 실제 브라우저와 동일한 TLS fingerprint 및 헤더 구조를 재현하고, 요청 간격을 랜덤화해 안정적인 수집 환경을 구축했습니다.

### UTC / KST 시간대 불일치
Vercel과 Supabase는 UTC 기준, Windows 수집기는 KST 기준으로 동작합니다. `rank_hour`를 UTC로 통일해 저장하고 프론트엔드에서 `(utcHour + 9) % 24`로 변환합니다. AI 분석 캐싱에서도 `new Date().toLocaleDateString()`은 Vercel에서 UTC 날짜를 반환하기 때문에 `Date.now() + 9 * 3600 * 1000`으로 KST 날짜를 직접 계산해 해결했습니다.

### 중복 수집 방지로 DB 효율화
올리브영 랭킹은 약 3시간 주기로 갱신되지만 수집기는 매시간 실행됩니다. 신규 수집 데이터를 DB의 직전 스냅샷과 `goods_no` 순서로 비교해 변화가 없으면 저장을 스킵하는 방식으로 불필요한 행을 약 66% 절감했습니다.

### 브랜드 키워드 노이즈 필터링
네이버 검색 노출 분석에서 "셀퓨전씨" 같은 브랜드 전용 키워드는 자사 상품만 노출되어 경쟁 분석이 의미 없습니다. 키워드별 자사 상품 점유율이 80% 이상인 경우를 브랜드 키워드로 자동 판별해 경쟁 매트릭스에서 제외하고, 경쟁이 실제로 발생하는 키워드만 분석 대상으로 남깁니다.

### 챗봇 응답 지연 해소 (스트리밍 + 3중 최적화)
도구 호출이 포함된 질문은 DB 조회와 Claude 재호출이 겹쳐 20초 이상 걸리는 문제가 있었습니다. 세 가지를 동시에 적용해 해결했습니다.

1. **스트리밍**: `client.messages.stream()`으로 텍스트 청크를 생성 즉시 전송 — 도구 실행 중엔 로딩 표시, 응답 시작과 동시에 타이핑 효과
2. **병렬 도구 실행**: Claude가 한 라운드에 여러 도구를 요청할 때 `Promise.all()`로 DB를 동시 조회 — 2개 도구 기준 처리 시간 절반 단축
3. **프롬프트 캐싱**: 시스템 프롬프트(~2,000토큰)와 16개 도구 정의에 `cache_control: ephemeral` 적용 — 반복 요청 시 입력 처리 비용 90% 절감

### AI 응답 캐싱 전략
Claude API 호출은 응답 생성에 수 초가 걸립니다. 분석 결과를 DB에 KST 날짜 + 시간대(오전/오후) 기준으로 캐싱하고, 수집기 완료 시 `/api/revalidate`로 ISR 캐시 초기화와 AI 캐시 워밍업을 동시에 처리합니다. 페이지가 열리기 전에 결과가 이미 준비되어 있어 즉시 응답이 가능합니다.

---

## Stack

| 분류 | 기술 |
|---|---|
| 수집기 | Python 3.12, curl_cffi, BeautifulSoup4, psycopg2 |
| 데이터베이스 | Supabase PostgreSQL (서울 리전) |
| 프론트엔드 | Next.js 15 App Router, React 19, TypeScript 5 |
| 스타일링 | Tailwind CSS v4, Framer Motion |
| 차트 | Recharts |
| 배포 | Vercel (ISR + On-demand Revalidation) |
| 스케줄러 | Windows Task Scheduler |
| AI | Claude Sonnet 4.6 (대시보드 분석 + 챗봇 + MCP) |

---

## Project Structure

```
├── collector/
│   ├── pipeline.py            # 올리브영 리뷰 수집 및 전처리
│   ├── rank_collector.py      # 카테고리 순위 수집 (중복 감지 포함)
│   ├── promo_collector.py     # 올영픽 · 오늘의 특가 수집
│   ├── coupang_pipeline.py    # 쿠팡 리뷰 수집
│   ├── coupang_rank.py        # 쿠팡 검색순위 · 카테고리 순위 수집
│   └── naver_collector.py     # 네이버 트렌드 · 검색 노출 · 시장 데이터 수집
├── web/
│   ├── app/
│   │   ├── page.tsx           # 메인 대시보드 (Server Component)
│   │   └── api/
│   │       ├── chat/          # Claude Sonnet 4.6 챗봇 (스트리밍 + 병렬 도구)
│   │       ├── mcp/           # Model Context Protocol 서버
│   │       └── revalidate/    # ISR 초기화 + AI 캐시 워밍업
│   ├── components/
│   │   ├── CoupangDashboard.tsx   # 쿠팡 Beta 대시보드
│   │   ├── NaverDashboard.tsx     # 네이버 Beta 대시보드
│   │   └── ChatWidget.tsx         # 멀티플랫폼 AI 챗봇 위젯
│   └── lib/
│       ├── db.ts              # DB 쿼리 함수 모음 (전 플랫폼)
│       ├── ai.ts              # Claude AI 호출 + KST 캐싱
│       └── types.ts           # 공유 타입 정의
└── db/
    ├── schema.py              # 올리브영 테이블 스키마
    ├── coupang_schema.py      # 쿠팡 테이블 스키마
    └── naver_schema.py        # 네이버 테이블 스키마
```

---

<div align="center">
  <sub>Python · Next.js · Supabase · Vercel · Claude Sonnet 4.6 · MCP</sub>
</div>
