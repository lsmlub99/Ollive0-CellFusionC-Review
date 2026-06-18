"""
OliveYoung Insight MCP Server
Supabase DB를 읽어 Claude에게 데이터 도구를 제공하는 원격 MCP 서버.

배포: Render (uvicorn server:app)
연결: Claude Desktop → claude_desktop_config.json 의 mcpServers.url
"""
import os
import re
from collections import Counter
from decimal import Decimal
from datetime import date, datetime

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from starlette.types import ASGIApp, Receive, Scope, Send

load_dotenv()

mcp = FastMCP("OliveYoung Insight")


# ── DB 연결 ───────────────────────────────────────────

def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        cursor_factory=psycopg2.extras.RealDictCursor,
        options="-c search_path=oliveyoung",
    )


def serialize(rows: list) -> list[dict]:
    """PostgreSQL 타입(date, Decimal 등) → JSON 직렬화 가능 dict"""
    result = []
    for row in rows:
        d = {}
        for k, v in row.items():
            if isinstance(v, (date, datetime)):
                d[k] = v.isoformat()
            elif isinstance(v, Decimal):
                d[k] = float(v)
            else:
                d[k] = v
        result.append(d)
    return result


# ── 도구 정의 ─────────────────────────────────────────

@mcp.tool()
def get_stats() -> dict:
    """셀퓨전씨 올리브영 전체 현황: 총 리뷰 수, 평균 별점, 재구매율, 상품 수, 마지막 수집 시각"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    (SELECT COUNT(*) FROM reviews)::int                          AS total_reviews,
                    (SELECT COUNT(*) FROM products)::int                         AS total_products,
                    ROUND(AVG(r.score)::numeric, 2)                              AS avg_score,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE r.score = 5)
                          / NULLIF(COUNT(*), 0), 1)                             AS five_star_pct,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE r.is_repurchase)
                          / NULLIF(COUNT(*), 0), 1)                             AS repurchase_pct,
                    MAX(r.collected_at)::text                                    AS last_updated
                FROM reviews r
            """)
            row = cur.fetchone()
            return dict(row) if row else {}
    finally:
        conn.close()


@mcp.tool()
def get_market_rankings(category: str = "") -> list[dict]:
    """올리브영 카테고리별 베스트 순위 (오늘 최신 수집 기준 Top 20).
    category 미입력 시 전체 카테고리 반환. 셀퓨전씨 상품은 is_ours=True."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                WITH latest AS (
                    SELECT MAX(rank_hour) AS h
                    FROM market_rankings
                    WHERE rank_date = CURRENT_DATE
                )
                SELECT mr.category_name, mr.rank_position, mr.goods_no, mr.goods_name,
                       (p.goods_no IS NOT NULL) AS is_ours
                FROM market_rankings mr
                CROSS JOIN latest
                LEFT JOIN products p ON mr.goods_no = p.goods_no
                WHERE mr.rank_date = CURRENT_DATE
                  AND mr.rank_hour = latest.h
                  AND (%s = '' OR mr.category_name = %s)
                  AND mr.rank_position <= 20
                ORDER BY mr.category_name, mr.rank_position
            """, (category, category))
            return serialize(cur.fetchall())
    finally:
        conn.close()


@mcp.tool()
def get_promo_status() -> list[dict]:
    """오늘 기준 올영픽 / 오늘의 특가 입점 현황. 셀퓨전씨 상품 포함 여부 및 순위 확인."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pi.promo_type, pi.rank_position, pi.goods_no, pi.goods_name,
                       (p.goods_no IS NOT NULL) AS is_ours,
                       pi.collected_at::text AS collected_at
                FROM promo_items pi
                LEFT JOIN products p ON pi.goods_no = p.goods_no
                WHERE pi.collected_at::date = CURRENT_DATE
                ORDER BY pi.promo_type, pi.rank_position
                LIMIT 100
            """)
            return serialize(cur.fetchall())
    finally:
        conn.close()


@mcp.tool()
def get_negative_alerts() -> list[dict]:
    """최근 7일 부정 리뷰(별점 1~2) 급증 상품. 전주 대비 50%+ 증가한 상품과 증가율."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                WITH recent AS (
                    SELECT goods_no, COUNT(*) AS cnt
                    FROM reviews
                    WHERE score <= 2
                      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
                    GROUP BY goods_no
                ),
                prev AS (
                    SELECT goods_no, COUNT(*) AS cnt
                    FROM reviews
                    WHERE score <= 2
                      AND created_at >= CURRENT_DATE - INTERVAL '14 days'
                      AND created_at <  CURRENT_DATE - INTERVAL '7 days'
                    GROUP BY goods_no
                )
                SELECT p.goods_name,
                       r.cnt  AS recent_neg,
                       COALESCE(prev.cnt, 0) AS prev_neg,
                       CASE WHEN COALESCE(prev.cnt, 0) > 0
                            THEN ROUND(100.0 * (r.cnt - prev.cnt) / prev.cnt)
                            ELSE NULL END AS increase_pct
                FROM recent r
                JOIN products p ON r.goods_no = p.goods_no
                LEFT JOIN prev ON r.goods_no = prev.goods_no
                WHERE r.cnt >= 3
                  AND (prev.cnt IS NULL OR r.cnt > prev.cnt * 1.5)
                ORDER BY r.cnt DESC
            """)
            return serialize(cur.fetchall())
    finally:
        conn.close()


@mcp.tool()
def get_product_stats() -> list[dict]:
    """상품별 리뷰 수, 평균 별점, 재구매율, 5점 리뷰 수"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.goods_name,
                       COUNT(r.review_id)                                        AS review_cnt,
                       ROUND(AVG(r.score)::numeric, 2)                          AS avg_score,
                       ROUND(100.0 * SUM(CASE WHEN r.is_repurchase THEN 1 ELSE 0 END)
                             / NULLIF(COUNT(*), 0), 1)                          AS repurchase_pct,
                       COUNT(*) FILTER (WHERE r.score = 5)                      AS five_star_cnt
                FROM products p
                LEFT JOIN reviews r ON p.goods_no = r.goods_no
                GROUP BY p.goods_no, p.goods_name
                ORDER BY review_cnt DESC
            """)
            return serialize(cur.fetchall())
    finally:
        conn.close()


STOPWORDS = {
    '이', '가', '을', '를', '은', '는', '에', '의', '로', '으로', '도', '만', '와', '과',
    '이고', '하고', '에서', '같은', '같아요', '정도', '같습니다', '같고', '있어요', '있고',
    '너무', '정말', '진짜', '완전', '많이', '좋아요', '좋고', '좋은', '좋습니다', '그리고',
    '하지만', '그런데', '근데', '그냥', '이번', '다음', '사용', '제품', '구매', '배송',
}


def _top_keywords(rows: list, n: int = 8) -> list[dict]:
    words = []
    for row in rows:
        tokens = re.findall(r'[가-힣]{2,5}', row.get('content') or '')
        words.extend(t for t in tokens if t not in STOPWORDS)
    return [{'word': w, 'cnt': c} for w, c in Counter(words).most_common(n)]


@mcp.tool()
def get_insights(goods_no: str = "") -> dict:
    """긍정/부정 키워드 Top 8, 피부 타입 분포. goods_no 미입력 시 전체 브랜드 기준."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            extra = "AND r.goods_no = %s"
            p = (goods_no,)

            if goods_no:
                cur.execute(f"SELECT content FROM reviews r WHERE score >= 4 {extra} LIMIT 500", p)
            else:
                cur.execute("SELECT content FROM reviews WHERE score >= 4 LIMIT 500")
            pos = cur.fetchall()

            if goods_no:
                cur.execute(f"SELECT content FROM reviews r WHERE score <= 2 {extra} LIMIT 300", p)
            else:
                cur.execute("SELECT content FROM reviews WHERE score <= 2 LIMIT 300")
            neg = cur.fetchall()

            if goods_no:
                cur.execute(
                    f"SELECT skin_type, COUNT(*) AS cnt FROM reviews r WHERE skin_type IS NOT NULL {extra} GROUP BY skin_type ORDER BY cnt DESC LIMIT 6",
                    p)
            else:
                cur.execute(
                    "SELECT skin_type, COUNT(*) AS cnt FROM reviews WHERE skin_type IS NOT NULL GROUP BY skin_type ORDER BY cnt DESC LIMIT 6")
            skin = cur.fetchall()

            return {
                'positive_keywords': _top_keywords(pos),
                'negative_keywords': _top_keywords(neg),
                'skin_dist': serialize(skin),
            }
    finally:
        conn.close()


@mcp.tool()
def get_new_products() -> list[dict]:
    """최근 30일 내 처음 리뷰가 등록된 신규 상품. 리뷰 속도(일 평균)와 긍정/부정 비율 포함."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                WITH first_seen AS (
                    SELECT goods_no, MIN(created_at)::date AS first_date
                    FROM reviews GROUP BY goods_no
                )
                SELECT p.goods_name,
                       fs.first_date::text                                             AS first_seen,
                       (CURRENT_DATE - fs.first_date)                                 AS days_since_launch,
                       COUNT(r.review_id)                                              AS total_reviews,
                       ROUND(COUNT(r.review_id)::numeric
                             / NULLIF(CURRENT_DATE - fs.first_date, 0), 1)            AS daily_avg,
                       ROUND(100.0 * COUNT(*) FILTER (WHERE r.score >= 4)
                             / NULLIF(COUNT(*), 0), 1)                                AS pos_pct,
                       ROUND(100.0 * COUNT(*) FILTER (WHERE r.score <= 2)
                             / NULLIF(COUNT(*), 0), 1)                                AS neg_pct
                FROM first_seen fs
                JOIN products p ON fs.goods_no = p.goods_no
                JOIN reviews r   ON fs.goods_no = r.goods_no
                WHERE fs.first_date >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY p.goods_no, p.goods_name, fs.first_date
                ORDER BY fs.first_date DESC
            """)
            return serialize(cur.fetchall())
    finally:
        conn.close()


@mcp.tool()
def get_today_ranking() -> list[dict]:
    """오늘 시간별 셀퓨전씨 자사 상품 순위 타임라인. 몇 시에 어느 카테고리에서 몇 위였는지."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT mr.rank_hour, mr.category_name, mr.rank_position,
                       mr.goods_no, mr.goods_name
                FROM market_rankings mr
                JOIN products p ON mr.goods_no = p.goods_no
                WHERE mr.rank_date = CURRENT_DATE
                ORDER BY mr.rank_hour, mr.category_name, mr.rank_position
            """)
            return serialize(cur.fetchall())
    finally:
        conn.close()


@mcp.tool()
def get_reviews_by_date(date: str, goods_no: str = "") -> list[dict]:
    """특정 날짜에 등록된 올리브영 리뷰 목록.
    date: YYYY-MM-DD 형식 (예: 2026-06-05). goods_no 생략 시 전체 상품."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.goods_name, r.score, r.content, r.created_at, r.skin_type, r.is_repurchase
                FROM reviews r
                JOIN products p ON r.goods_no = p.goods_no
                WHERE r.created_at::date = %s::date
                  AND (%s = '' OR r.goods_no = %s)
                  AND r.content IS NOT NULL AND r.content != ''
                ORDER BY r.created_at
                LIMIT 200
            """, (date, goods_no, goods_no))
            return serialize(cur.fetchall())
    finally:
        conn.close()


@mcp.tool()
def get_review_content(
    goods_no: str = "",
    date: str = "",
    filter: str = "all",
    limit: int = 50,
) -> list[dict]:
    """실제 리뷰 텍스트 조회. AI가 리뷰 내용을 직접 읽고 분석할 때 사용.
    filter: all / positive(4~5점) / negative(1~2점). limit 최대 200."""
    score_filter = ""
    if filter == "positive":
        score_filter = "AND r.score >= 4"
    elif filter == "negative":
        score_filter = "AND r.score <= 2"
    limit = min(limit, 200)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT p.goods_name, r.score, r.content, r.created_at, r.skin_type, r.is_repurchase
                FROM reviews r
                JOIN products p ON r.goods_no = p.goods_no
                WHERE (%s = '' OR r.goods_no = %s)
                  AND (%s = '' OR r.created_at::date = %s::date)
                  AND r.content IS NOT NULL AND r.content != ''
                  {score_filter}
                ORDER BY r.created_at DESC
                LIMIT %s
            """, (goods_no, goods_no, date, date, limit))
            return serialize(cur.fetchall())
    finally:
        conn.close()


@mcp.tool()
def get_weekly_delta() -> dict:
    """이번 주 vs 지난 주 비교. 리뷰 수·평균 별점·긍정비율·부정비율 변화량(delta) 포함."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - 7)              AS this_cnt,
                    COUNT(*) FILTER (WHERE created_at::date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8) AS last_cnt,
                    ROUND(AVG(score) FILTER (WHERE created_at::date >= CURRENT_DATE - 7)::numeric, 2) AS this_score,
                    ROUND(AVG(score) FILTER (WHERE created_at::date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8)::numeric, 2) AS last_score,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - 7 AND score >= 4)
                        / NULLIF(COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - 7), 0), 1) AS this_pos,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE created_at::date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8 AND score >= 4)
                        / NULLIF(COUNT(*) FILTER (WHERE created_at::date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8), 0), 1) AS last_pos,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - 7 AND score <= 2)
                        / NULLIF(COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - 7), 0), 1) AS this_neg,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE created_at::date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8 AND score <= 2)
                        / NULLIF(COUNT(*) FILTER (WHERE created_at::date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8), 0), 1) AS last_neg
                FROM reviews
                WHERE created_at::date >= CURRENT_DATE - 14
            """)
            r = dict(cur.fetchone())
            tw = {"review_cnt": int(r["this_cnt"] or 0), "avg_score": float(r["this_score"] or 0),
                  "pos_pct": float(r["this_pos"] or 0), "neg_pct": float(r["this_neg"] or 0)}
            lw = {"review_cnt": int(r["last_cnt"] or 0), "avg_score": float(r["last_score"] or 0),
                  "pos_pct": float(r["last_pos"] or 0), "neg_pct": float(r["last_neg"] or 0)}
            return {
                "this_week": tw,
                "last_week": lw,
                "delta": {
                    "review_cnt": tw["review_cnt"] - lw["review_cnt"],
                    "avg_score":  round(tw["avg_score"] - lw["avg_score"], 2),
                    "pos_pct":    round(tw["pos_pct"] - lw["pos_pct"], 1),
                    "neg_pct":    round(tw["neg_pct"] - lw["neg_pct"], 1),
                },
            }
    finally:
        conn.close()


@mcp.tool()
def get_product_summary(goods_no: str) -> dict:
    """상품 하나에 대한 종합 분석: 기본 통계 + 긍/부정 키워드 Top 10 + 최근 리뷰 5건 + 순위 이력.
    goods_no는 get_product_stats에서 확인 가능."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.goods_name,
                    COUNT(r.review_id) AS review_cnt,
                    ROUND(AVG(r.score)::numeric, 2) AS avg_score,
                    ROUND(100.0 * SUM(CASE WHEN r.is_repurchase THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0), 1) AS repurchase_pct,
                    COUNT(*) FILTER (WHERE r.score = 5) AS five_star_cnt
                FROM products p LEFT JOIN reviews r ON p.goods_no = r.goods_no
                WHERE p.goods_no = %s
                GROUP BY p.goods_no, p.goods_name
            """, (goods_no,))
            stats_row = cur.fetchone()

            cur.execute("""
                SELECT content FROM reviews
                WHERE goods_no = %s AND score >= 4 AND content IS NOT NULL LIMIT 300
            """, (goods_no,))
            pos_reviews = [r["content"] for r in cur.fetchall()]

            cur.execute("""
                SELECT content FROM reviews
                WHERE goods_no = %s AND score <= 2 AND content IS NOT NULL LIMIT 200
            """, (goods_no,))
            neg_reviews = [r["content"] for r in cur.fetchall()]

            cur.execute("""
                SELECT score, content, created_at::text, skin_type, is_repurchase
                FROM reviews WHERE goods_no = %s AND content IS NOT NULL AND content != ''
                ORDER BY created_at DESC LIMIT 5
            """, (goods_no,))
            recent = serialize(cur.fetchall())

            cur.execute("""
                SELECT category_name, rank_position, rank_date::text
                FROM market_rankings WHERE goods_no = %s
                ORDER BY rank_date DESC, rank_position LIMIT 20
            """, (goods_no,))
            ranking = serialize(cur.fetchall())

            return {
                "goods_no":   goods_no,
                "goods_name": stats_row["goods_name"] if stats_row else "",
                "stats": {
                    "review_cnt":     int(stats_row["review_cnt"] or 0) if stats_row else 0,
                    "avg_score":      float(stats_row["avg_score"] or 0) if stats_row else 0,
                    "repurchase_pct": float(stats_row["repurchase_pct"] or 0) if stats_row else 0,
                    "five_star_cnt":  int(stats_row["five_star_cnt"] or 0) if stats_row else 0,
                },
                "positive_keywords": _top_keywords([{"content": c} for c in pos_reviews], 10),
                "negative_keywords": _top_keywords([{"content": c} for c in neg_reviews], 10),
                "recent_reviews": recent,
                "ranking": ranking,
            }
    finally:
        conn.close()


# ── 인증 미들웨어 ──────────────────────────────────────

class APIKeyMiddleware:
    """Bearer 토큰 인증. MCP_API_KEY 미설정 시 인증 없이 허용 (로컬 개발용)."""

    def __init__(self, app: ASGIApp):
        self.app = app
        self.key = os.getenv("MCP_API_KEY", "")

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] in ("http", "websocket") and self.key:
            headers = dict(scope.get("headers", []))
            auth = headers.get(b"authorization", b"").decode()
            if auth != f"Bearer {self.key}":
                if scope["type"] == "http":
                    await send({"type": "http.response.start", "status": 401,
                                "headers": [(b"content-type", b"text/plain")]})
                    await send({"type": "http.response.body", "body": b"Unauthorized"})
                return
        await self.app(scope, receive, send)


# ── ASGI 앱 (uvicorn 진입점) ──────────────────────────

app = APIKeyMiddleware(mcp.sse_app())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
