import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor,
                            options="-c statement_timeout=0")


def init_db(conn=None):
    def _run(c):
        with c.cursor() as cur:
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
                CREATE INDEX IF NOT EXISTS idx_reviews_goods_no ON reviews(goods_no)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at)
            """)

    if conn is not None:
        _run(conn)
    else:
        with get_conn() as c:
            _run(c)
            c.commit()


def upsert_products(products: list[dict], conn=None):
    if not products:
        return

    def _run(c):
        with c.cursor() as cur:
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

    if conn is not None:
        _run(conn)
    else:
        with get_conn() as c:
            _run(c)
            c.commit()


def insert_review(review: dict, goods_no: str, conn=None):
    profile = review.get("profileDto") or {}
    trouble = json.dumps(profile.get("skinTrouble", []), ensure_ascii=False)
    params = (
        review["reviewId"],
        goods_no,
        review.get("content", ""),
        review.get("reviewScore"),
        profile.get("skinType"),
        trouble,
        review.get("isRepurchase", False),
        review.get("createdDateTime"),
    )
    sql = """
        INSERT INTO reviews
            (review_id, goods_no, content, score, skin_type, skin_trouble, is_repurchase, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (review_id) DO NOTHING
    """
    if conn is not None:
        with conn.cursor() as cur:
            cur.execute(sql, params)
    else:
        with get_conn() as c:
            with c.cursor() as cur:
                cur.execute(sql, params)
            c.commit()


def get_existing_review_ids(conn=None) -> set[int]:
    def _run(c):
        with c.cursor() as cur:
            cur.execute("SELECT review_id FROM reviews")
            return {r["review_id"] for r in cur.fetchall()}

    if conn is not None:
        return _run(conn)
    else:
        with get_conn() as c:
            return _run(c)


def get_all_products(conn=None) -> list[dict]:
    def _run(c):
        with c.cursor() as cur:
            cur.execute("SELECT goods_no, goods_name FROM products ORDER BY goods_name")
            return list(cur.fetchall())

    if conn is not None:
        return _run(conn)
    else:
        with get_conn() as c:
            return _run(c)
