import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    goods_no    TEXT PRIMARY KEY,
                    goods_name  TEXT,
                    rating      REAL,
                    review_count TEXT,
                    first_seen  DATE DEFAULT CURRENT_DATE,
                    last_seen   DATE DEFAULT CURRENT_DATE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    review_id     BIGINT PRIMARY KEY,
                    goods_no      TEXT REFERENCES products(goods_no),
                    content       TEXT,
                    score         SMALLINT,
                    skin_type     TEXT,
                    skin_trouble  TEXT,
                    is_repurchase BOOLEAN,
                    created_at    TEXT,
                    collected_at  TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_reviews_goods_no ON reviews(goods_no);
                CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
            """)
        conn.commit()


def upsert_products(products: list[dict]):
    if not products:
        return
    with get_conn() as conn:
        with conn.cursor() as cur:
            for p in products:
                cur.execute("""
                    INSERT INTO products (goods_no, goods_name, rating, review_count, first_seen, last_seen)
                    VALUES (%s, %s, %s, %s, CURRENT_DATE, CURRENT_DATE)
                    ON CONFLICT (goods_no) DO UPDATE SET
                        goods_name   = EXCLUDED.goods_name,
                        rating       = EXCLUDED.rating,
                        review_count = EXCLUDED.review_count,
                        last_seen    = CURRENT_DATE
                """, (p["goods_no"], p["goods_name"], p["rating"], p["review_count"]))
        conn.commit()


def insert_review(review: dict, goods_no: str):
    profile = review.get("profileDto") or {}
    import json
    trouble = json.dumps(profile.get("skinTrouble", []), ensure_ascii=False)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO reviews
                    (review_id, goods_no, content, score, skin_type, skin_trouble, is_repurchase, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (review_id) DO NOTHING
            """, (
                review["reviewId"],
                goods_no,
                review.get("content", ""),
                review.get("reviewScore"),
                profile.get("skinType"),
                trouble,
                review.get("isRepurchase", False),
                review.get("createdDateTime"),
            ))
        conn.commit()


def get_existing_review_ids() -> set[int]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT review_id FROM reviews")
            return {r["review_id"] for r in cur.fetchall()}


def get_all_products() -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT goods_no, goods_name FROM products ORDER BY goods_name")
            return cur.fetchall()
