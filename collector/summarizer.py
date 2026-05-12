import os
import sys
import json
import random
import time
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from anthropic import Anthropic
from db.schema import get_conn, init_db

client = Anthropic()  # reads ANTHROPIC_API_KEY from env

PROMPT = """다음은 올리브영 '{name}' 제품의 실구매 리뷰 {n}개입니다.

{reviews}

아래 JSON 형식으로 분석해주세요. JSON만 출력하세요:
{{
  "pros": ["장점1 (구체적으로)", "장점2", "장점3"],
  "cons": ["단점1 (구체적으로)", "단점2", "단점3"],
  "customer_profile": "주요 구매 고객층 한 문장 (피부 타입, 고민, 사용 목적 중심으로)"
}}"""


def _sample_reviews(reviews: list[dict], max_total: int = 150, per_score: int = 30) -> list[dict]:
    by_score: dict[int, list] = {}
    for r in reviews:
        by_score.setdefault(r['score'], []).append(r)
    sampled = []
    for s in sorted(by_score, reverse=True):
        pool = by_score[s]
        sampled.extend(random.sample(pool, min(per_score, len(pool))))
    if len(sampled) > max_total:
        sampled = random.sample(sampled, max_total)
    return sampled


def summarize_product(goods_name: str, reviews: list[dict]) -> dict:
    sampled = _sample_reviews(reviews)
    review_text = '\n'.join(
        f"[{r['score']}★] {str(r['content'] or '').replace(chr(10), ' ')[:200]}"
        for r in sampled
    )
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        messages=[{"role": "user", "content": PROMPT.format(
            name=goods_name, n=len(sampled), reviews=review_text
        )}]
    )
    text = msg.content[0].text.strip()
    if '```' in text:
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]
    return json.loads(text.strip())


def run():
    print(f"=== 상품 리뷰 AI 요약 시작 ===\n")
    conn = get_conn()
    conn.autocommit = True
    try:
        init_db(conn=conn)
        with conn.cursor() as cur:
            cur.execute("SELECT goods_no, goods_name FROM products ORDER BY goods_name")
            products = list(cur.fetchall())

        print(f"상품 {len(products)}개\n")

        for i, product in enumerate(products):
            goods_no = product['goods_no']
            goods_name = product['goods_name']

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT score, content FROM reviews "
                    "WHERE goods_no = %s AND content IS NOT NULL AND content != ''",
                    (goods_no,)
                )
                reviews = list(cur.fetchall())

            if len(reviews) < 10:
                print(f"  ({i+1}/{len(products)}) {goods_name[:30]} -리뷰 부족 ({len(reviews)}개) 스킵")
                continue

            print(f"  ({i+1}/{len(products)}) {goods_name[:30]} -{len(reviews)}개 리뷰 요약 중...")
            try:
                summary = summarize_product(goods_name, reviews)
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO product_summaries (goods_no, summary_json, generated_at)
                           VALUES (%s, %s, NOW())
                           ON CONFLICT (goods_no) DO UPDATE SET
                               summary_json = EXCLUDED.summary_json,
                               generated_at = NOW()""",
                        (goods_no, json.dumps(summary, ensure_ascii=False))
                    )
                print(f"    장점: {summary['pros'][0] if summary['pros'] else '-'}")
                print(f"    단점: {summary['cons'][0] if summary['cons'] else '-'}")
            except Exception as e:
                print(f"    오류: {e}")

            time.sleep(1.0)

        print("\n=== 완료 ===")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
