"""
경쟁사 상품 리뷰 수집기
- products 테이블의 is_competitor=true 상품들의 리뷰를 수집
- 분석용 최대 500개 (3가지 정렬로 수집, 기존 리뷰 스킵)
- 실행: python -m collector.competitor_pipeline
"""
import os
import sys
import random
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from db.schema import get_conn, init_db, insert_review, get_competitor_products, get_existing_review_ids
from collector.pipeline import fetch_new_review_ids, fetch_review_detail, revalidate_vercel

MAX_REVIEWS_PER_PRODUCT = 500


def run():
    print(f"=== 경쟁사 리뷰 수집 시작 ({datetime.now().strftime('%Y-%m-%d %H:%M')}) ===\n")

    conn = get_conn()
    conn.autocommit = True
    try:
        init_db(conn=conn)

        competitors = get_competitor_products(conn=conn)
        if not competitors:
            print("등록된 경쟁사 상품 없음 — rank_collector 먼저 실행하세요")
            return

        print(f"경쟁사 상품 {len(competitors)}개\n")

        existing_ids = get_existing_review_ids(conn=conn)
        total_new = 0

        for i, product in enumerate(competitors):
            goods_no = product["goods_no"]
            name = (product["goods_name"] or goods_no)[:35]

            # 이미 충분한 리뷰가 있으면 스킵
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS cnt FROM reviews WHERE goods_no = %s", (goods_no,))
                existing_cnt = cur.fetchone()['cnt']

            if existing_cnt >= MAX_REVIEWS_PER_PRODUCT:
                print(f"  ({i+1}/{len(competitors)}) {name} — 이미 {existing_cnt}개 스킵")
                continue

            new_ids = fetch_new_review_ids(goods_no, existing_ids)
            if not new_ids:
                print(f"  ({i+1}/{len(competitors)}) {name} — 신규 없음")
                continue

            # 최대 MAX_REVIEWS_PER_PRODUCT까지만 수집
            remaining = MAX_REVIEWS_PER_PRODUCT - existing_cnt
            new_ids = new_ids[:remaining]

            print(f"  ({i+1}/{len(competitors)}) {name} — 신규 {len(new_ids)}개 수집 중...")
            saved = 0
            for review_id in new_ids:
                detail = fetch_review_detail(review_id)
                if detail:
                    insert_review(detail, goods_no, conn=conn)
                    existing_ids.add(review_id)
                    total_new += 1
                    saved += 1
                time.sleep(random.uniform(0.3, 0.7))

            print(f"    → {saved}개 저장")
            time.sleep(random.uniform(2.0, 3.5))

        print(f"\n=== 완료 - 신규 {total_new}개 저장 ===")
        if total_new > 0:
            revalidate_vercel()
    finally:
        conn.close()


if __name__ == "__main__":
    run()
