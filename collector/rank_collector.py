import os
import sys
import time
import re
from datetime import date

try:
    from curl_cffi import requests as cf_requests
    _IMPERSONATE = "chrome120"
except ImportError:
    import requests as cf_requests
    _IMPERSONATE = None

from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from db.schema import get_conn, init_db

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Referer': 'https://www.oliveyoung.co.kr/store/main/getBestList.do',
    'Accept-Language': 'ko-KR,ko;q=0.9',
}

CATEGORIES = [
    ('선케어',      '900000100100001', '10000010011'),
    ('스킨/토너',   '900000100100001', '10000010001'),
    ('로션/크림',   '900000100100001', '10000010004'),
    ('에센스/세럼', '900000100100001', '10000010003'),
    ('마스크팩',    '900000100100001', '10000010006'),
    ('클렌징',      '900000100100001', '10000010007'),
]

ROWS_PER_PAGE = 100


def fetch_ranking(disp_cat: str, flt_cat: str) -> list[str]:
    """카테고리 베스트 페이지에서 goodsNo 순위 리스트 반환"""
    kwargs = dict(
        params={'dispCatNo': disp_cat, 'fltDispCatNo': flt_cat, 'pageIdx': 1, 'rowsPerPage': ROWS_PER_PAGE},
        headers=HEADERS,
        timeout=15,
    )
    if _IMPERSONATE:
        r = cf_requests.get('https://www.oliveyoung.co.kr/store/main/getBestList.do',
                            impersonate=_IMPERSONATE, **kwargs)
    else:
        r = cf_requests.get('https://www.oliveyoung.co.kr/store/main/getBestList.do', **kwargs)

    soup = BeautifulSoup(r.text, 'html.parser')
    seen = set()
    results = []
    for item in soup.select('.prd_info'):
        parent = item.find_parent('li')
        link = (parent or item).select_one('a[href*="goodsNo"]')
        if not link:
            continue
        m = re.search(r'goodsNo=([A-Z0-9]+)', link.get('href', ''))
        if not m or m.group(1) in seen:
            continue
        seen.add(m.group(1))
        results.append(m.group(1))
    return results


def run():
    print(f"=== 올리브영 카테고리 랭킹 수집 ({date.today()}) ===\n")

    conn = get_conn()
    conn.autocommit = True

    try:
        init_db(conn=conn)

        with conn.cursor() as cur:
            cur.execute('SELECT goods_no FROM products')
            our_goods = {r['goods_no'] for r in cur.fetchall()}

        print(f"자사 상품 {len(our_goods)}개 기준으로 랭킹 탐색\n")

        total_saved = 0

        for cat_name, disp, flt in CATEGORIES:
            print(f"[{cat_name}] 수집 중...")
            try:
                ranking = fetch_ranking(disp, flt)
                hits = [(i + 1, g) for i, g in enumerate(ranking) if g in our_goods]

                if hits:
                    with conn.cursor() as cur:
                        for rank, goods_no in hits:
                            cur.execute("""
                                INSERT INTO product_rankings (rank_date, goods_no, category_name, rank_position)
                                VALUES (CURRENT_DATE, %s, %s, %s)
                                ON CONFLICT (rank_date, goods_no, category_name)
                                DO UPDATE SET rank_position = EXCLUDED.rank_position
                            """, (goods_no, cat_name, rank))
                    total_saved += len(hits)
                    for rank, g in hits:
                        print(f"  {rank}위: {g}")
                else:
                    print(f"  Top {ROWS_PER_PAGE} 없음")

            except Exception as e:
                print(f"  오류: {e}")

            time.sleep(3)

        print(f"\n=== 완료 - {total_saved}개 순위 저장 ===")

    finally:
        conn.close()


if __name__ == "__main__":
    run()
