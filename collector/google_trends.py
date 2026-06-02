import os
import sys
import time
from datetime import date

import psycopg2
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from db.amazon_schema import get_conn, init_db

KEYWORDS = [
    'Korean sunscreen',
    'K-beauty',
    'CellFusionC',
    'Korean skincare',
]

# 미국 내륙(중서부/남부) vs 해안(CA/NY/FL) 구분용 참고 목록
INLAND_STATES = {'IL', 'OH', 'TX', 'GA', 'CO', 'MN', 'MO', 'WI', 'IN', 'TN', 'KY', 'AL', 'MS', 'AR', 'KS', 'NE', 'IA', 'OK', 'ND', 'SD', 'WY', 'MT', 'ID', 'NV', 'AZ', 'NM', 'UT'}
COASTAL_STATES = {'CA', 'NY', 'FL', 'WA', 'OR', 'MA', 'NJ', 'CT', 'MD', 'VA', 'NC', 'SC', 'ME', 'NH', 'RI', 'DE', 'HI', 'AK'}


def collect_trends(conn) -> int:
    """pytrends로 미국 주별 관심도 수집 → regional_trends 저장"""
    try:
        from pytrends.request import TrendReq
    except ImportError:
        print('pytrends 미설치. pip install pytrends 실행 후 재시도')
        return 0

    today = date.today()
    total_saved = 0

    # pytrends는 한 번에 최대 5개 키워드
    for i in range(0, len(KEYWORDS), 5):
        batch = KEYWORDS[i:i + 5]
        print(f'  키워드 배치: {batch}')

        try:
            pytrends = TrendReq(hl='en-US', tz=0, timeout=(10, 25),
                                retries=2, backoff_factor=0.5)
            pytrends.build_payload(kw_list=batch, geo='US', timeframe='now 7-d')
            df = pytrends.interest_by_region(resolution='REGION', inc_low_vol=True)

            if df.empty:
                print('    데이터 없음')
                time.sleep(5)
                continue

            # df index = region name (state name), columns = keywords
            with conn.cursor() as cur:
                for region_name, row in df.iterrows():
                    # region_name: "California", "Illinois" 등
                    # ISO 코드 변환 시도
                    state_abbr = _state_name_to_abbr(str(region_name))
                    region_code = f'US-{state_abbr}' if state_abbr else f'US-{region_name[:2].upper()}'

                    for keyword in batch:
                        interest = int(row.get(keyword, 0) or 0)
                        cur.execute("""
                            INSERT INTO regional_trends
                                (collected_at, keyword, region_code, region_name, interest)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (collected_at, keyword, region_code)
                            DO UPDATE SET interest = EXCLUDED.interest
                        """, (today, keyword, region_code, str(region_name), interest))
                        total_saved += 1

            print(f'    {len(df)}개 주, {len(batch)}개 키워드 저장')

        except Exception as e:
            print(f'    오류: {e}')

        time.sleep(10)  # pytrends rate limit 방지

    return total_saved


def _state_name_to_abbr(name: str) -> str:
    mapping = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
        'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
        'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
        'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
        'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
        'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
        'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
        'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
        'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
        'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
        'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
    }
    return mapping.get(name, '')


def print_summary(conn):
    """수집된 데이터 요약 출력 (내륙 vs 해안 비교)"""
    today = date.today()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT keyword, region_code, region_name, interest
            FROM regional_trends
            WHERE collected_at = %s
              AND keyword = 'Korean sunscreen'
            ORDER BY interest DESC
            LIMIT 10
        """, (today,))
        rows = cur.fetchall()

    if rows:
        print('\n  [Korean sunscreen] 관심도 Top 10:')
        for r in rows:
            abbr = r['region_code'].replace('US-', '')
            tag = '(내륙)' if abbr in INLAND_STATES else '(해안)' if abbr in COASTAL_STATES else ''
            print(f'    {r["region_name"]:20s} {r["interest"]:3d}  {tag}')


def run():
    print(f"=== Google Trends 수집 ({date.today()}) ===\n")

    conn = get_conn()
    conn.autocommit = True

    try:
        init_db(conn=conn)
        total = collect_trends(conn)
        print(f'\n총 {total}건 저장')
        print_summary(conn)
        print('\n=== 완료 ===')

    finally:
        conn.close()


if __name__ == '__main__':
    run()
