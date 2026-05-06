import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import streamlit as st
import pandas as pd
import plotly.express as px
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

DATABASE_URL = os.environ["DATABASE_URL"]

st.set_page_config(page_title="셀퓨전씨 리뷰 대시보드", page_icon="🧴", layout="wide")


@st.cache_resource
def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def query(sql, params=None):
    with psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


# ── 헤더
st.title("🧴 셀퓨전씨 올리브영 리뷰 대시보드")
st.caption(f"매일 오전 6시 자동 업데이트")

# ── 전체 요약 지표
col1, col2, col3, col4 = st.columns(4)
total_reviews = query("SELECT COUNT(*) AS cnt FROM reviews")[0]["cnt"]
total_products = query("SELECT COUNT(*) AS cnt FROM products")[0]["cnt"]
avg_score = query("SELECT ROUND(AVG(score)::numeric, 2) AS avg FROM reviews")[0]["avg"]
new_today = query("SELECT COUNT(*) AS cnt FROM reviews WHERE collected_at::date = CURRENT_DATE")[0]["cnt"]

col1.metric("총 리뷰 수", f"{total_reviews:,}개")
col2.metric("등록 상품 수", f"{total_products}개")
col3.metric("전체 평균 평점", f"⭐ {avg_score}")
col4.metric("오늘 신규 수집", f"{new_today}개")

st.divider()

# ── 상품별 평점 & 리뷰 수
st.subheader("📦 상품별 현황")
product_stats = query("""
    SELECT
        p.goods_name,
        COUNT(r.review_id)               AS review_cnt,
        ROUND(AVG(r.score)::numeric, 2)  AS avg_score,
        SUM(r.is_repurchase::int)        AS repurchase_cnt
    FROM products p
    LEFT JOIN reviews r ON p.goods_no = r.goods_no
    GROUP BY p.goods_name
    ORDER BY review_cnt DESC
""")
df_products = pd.DataFrame(product_stats)
if not df_products.empty:
    df_products.columns = ["상품명", "리뷰 수", "평균 평점", "재구매 수"]
    df_products["상품명"] = df_products["상품명"].str[:25]
    st.dataframe(df_products, use_container_width=True, hide_index=True)

st.divider()

# ── 일별 리뷰 트렌드
st.subheader("📈 일별 리뷰 추이 (최근 30일)")
trend = query("""
    SELECT created_at::text AS date, COUNT(*) AS cnt
    FROM reviews
    WHERE created_at >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY.MM.DD')
    GROUP BY created_at
    ORDER BY created_at
""")
if trend:
    df_trend = pd.DataFrame(trend)
    df_trend.columns = ["날짜", "리뷰 수"]
    fig = px.bar(df_trend, x="날짜", y="리뷰 수", color_discrete_sequence=["#FF6B6B"])
    fig.update_layout(margin=dict(l=0, r=0, t=20, b=0))
    st.plotly_chart(fig, use_container_width=True)

st.divider()

# ── 상품별 최근 리뷰 보기
st.subheader("🔍 상품별 최근 리뷰")
products_list = query("SELECT goods_no, goods_name FROM products ORDER BY goods_name")
product_map = {p["goods_name"][:40]: p["goods_no"] for p in products_list}
selected = st.selectbox("상품 선택", list(product_map.keys()))

if selected:
    reviews = query("""
        SELECT score, content, skin_type, is_repurchase, created_at
        FROM reviews
        WHERE goods_no = %s
        ORDER BY created_at DESC
        LIMIT 50
    """, (product_map[selected],))

    score_filter = st.slider("평점 필터", 1, 5, (1, 5))
    filtered = [r for r in reviews if r["score"] and score_filter[0] <= r["score"] <= score_filter[1]]

    st.caption(f"{len(filtered)}개 리뷰")
    for r in filtered:
        repurchase = "🔁 재구매" if r["is_repurchase"] else ""
        skin = f"피부: {r['skin_type']}" if r["skin_type"] else ""
        badge = " · ".join(filter(None, [repurchase, skin]))
        with st.expander(f"⭐ {r['score']}점  {r['created_at']}  {badge}"):
            st.write(r["content"])

st.divider()

# ── 평점 분포
st.subheader("⭐ 전체 평점 분포")
score_dist = query("""
    SELECT score, COUNT(*) AS cnt
    FROM reviews WHERE score IS NOT NULL
    GROUP BY score ORDER BY score
""")
if score_dist:
    df_score = pd.DataFrame(score_dist)
    df_score.columns = ["평점", "리뷰 수"]
    fig2 = px.bar(df_score, x="평점", y="리뷰 수", color_discrete_sequence=["#4ECDC4"])
    fig2.update_layout(margin=dict(l=0, r=0, t=20, b=0))
    st.plotly_chart(fig2, use_container_width=True)
