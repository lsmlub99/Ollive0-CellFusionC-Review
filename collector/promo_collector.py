"""
올리브영 프로모션 수집기 — 올영픽 / 오늘의 특가 / 하루특가
실행: python collector/promo_collector.py

NOTE: 올리브영 프로모션 URL은 이벤트마다 바뀔 수 있음.
      실제 URL은 브라우저 Network 탭에서 확인 후 PROMO_SOURCES를 업데이트할 것.
"""
import os
import sys
import re
import time
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
    'Referer': 'https://www.oliveyoung.co.kr/',
    'Accept-Language': 'ko-KR,ko;q=0.9',
}

# 각 프로모션 타입과 수집 URL 설정
# URL은 브라우저 Network 탭에서 실제 XHR 요청을 확인해 업데이트 필요
PROMO_SOURCES = [
    {
        'type': 'olivepick',
        'label': '올영픽',
        'url': 'https://www.oliveyoung.co.kr/store/main/getOlivePickMain.do',
        'params': {},
    },
    # 오늘의 특가 / 하루특가 URL은 이벤트마다 변경됨 — 확인 후 추가
    # {
    #     'type': 'today_deal',
    #     'label': '오늘의 특가',
    #     'url': 'https://www.oliveyoung.co.kr/store/event/getEventGoodsList.do',
    #     'params': {'eventNo': 'XXXX'},
    # },
]


def fetch_promo(url: str, params: dict) -> list[dict]:
    """프로모션 페이지에서 {goods_no, name, rank_position} 리스트 반환"""
    kwargs = dict(params=params, headers=HEADERS, timeout=15)
    if _IMPERSONATE:
        r = cf_requests.get(url, impersonate=_IMPERSONATE, **kwargs)
    else:
        r = cf_requests.get(url, **kwargs)

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
        goods_no = m.group(1)
        seen.add(goods_no)
        name_el = item.select_one('.tx_name, .prd_name, strong.tx_name, .name')
        name = name_el.get_text(strip=True) if name_el else ''
        results.append({'goods_no': goods_no, 'name': name, 'rank_position': len(results) + 1})

    return results


def run():
    print(f"=== 올리브영 프로모션 수집 ({date.today()}) ===\n")

    conn = get_conn()
    conn.autocommit = True

    try:
        init_db(conn=conn)

        with conn.cursor() as cur:
            cur.execute('SELECT goods_no FROM products')
            our_goods = {r['goods_no'] for r in cur.fetchall()}

        print(f"자사 상품 {len(our_goods)}개 기준\n")

        for source in PROMO_SOURCES:
            ptype = source['type']
            label = source['label']
            print(f"[{label}] 수집 중...")

            try:
                items = fetch_promo(source['url'], source['params'])
                print(f"  {len(items)}개 상품 파싱")

                if not items:
                    print(f"  경고: 상품 없음 — URL 또는 파싱 셀렉터 확인 필요")
                    continue

                with conn.cursor() as cur:
                    # 오늘 기존 데이터 삭제 후 재삽입 (순위 갱신)
                    cur.execute(
                        "DELETE FROM promo_items WHERE promo_type = %s AND collected_at = CURRENT_DATE",
                        (ptype,)
                    )
                    for item in items:
                        is_ours = item['goods_no'] in our_goods
                        cur.execute("""
                            INSERT INTO promo_items
                                (promo_type, collected_at, rank_position, goods_no, goods_name, is_ours)
                            VALUES (%s, CURRENT_DATE, %s, %s, %s, %s)
                            ON CONFLICT (promo_type, collected_at, goods_no) DO UPDATE SET
                                rank_position = EXCLUDED.rank_position,
                                goods_name    = EXCLUDED.goods_name,
                                is_ours       = EXCLUDED.is_ours
                        """, (ptype, item['rank_position'], item['goods_no'], item['name'], is_ours))

                our_hits = [it for it in items if it['goods_no'] in our_goods]
                if our_hits:
                    print(f"  자사 입점: " + ", ".join(f"{it['rank_position']}위 {it['name']}" for it in our_hits))
                else:
                    print(f"  자사 미입점")

            except Exception as e:
                print(f"  오류: {e}")

            time.sleep(2)

        print(f"\n=== 완료 ===")

    finally:
        conn.close()


if __name__ == "__main__":
    run()
