"""Chrome 프로필 + AJAX 최종 검증 — COSRX 리뷰 수집 테스트"""
import sys, time, os, winreg
sys.path.insert(0, '.')
import undetected_chromedriver as uc
from bs4 import BeautifulSoup

PROFILE_DIR = 'chrome_profile_amazon'
TEST_ASIN = 'B07BFZSCVR'  # COSRX Snail Mucin — 리뷰 수만 개

def _chrome_ver():
    try:
        for hive, path in [
            (winreg.HKEY_CURRENT_USER, r'SOFTWARE\Google\Chrome\BLBeacon'),
            (winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Google\Chrome\BLBeacon'),
        ]:
            try:
                with winreg.OpenKey(hive, path) as k:
                    return int(winreg.QueryValueEx(k, 'version')[0].split('.')[0])
            except OSError: continue
    except Exception: pass
    return 148

options = uc.ChromeOptions()
options.add_argument('--no-sandbox')
options.add_argument('--disable-gpu')
options.add_argument('--lang=en-US,en')
options.add_argument('--window-size=1280,800')

print(f"프로필 경로: {os.path.abspath(PROFILE_DIR)}")
print(f"프로필 존재: {os.path.isdir(PROFILE_DIR)}")

driver = uc.Chrome(
    options=options,
    version_main=_chrome_ver(),
    user_data_dir=os.path.abspath(PROFILE_DIR),
)
print("Chrome 시작됨")

driver.get('https://www.amazon.com/')
time.sleep(5)

# 로그인 상태 확인
page = driver.page_source[:5000]
if 'Hello,' in page:
    import re
    m = re.search(r'Hello, (.+?)<', page)
    name = m.group(1) if m else '(이름 파싱 불가)'
    print(f"로그인 확인: Hello, {name}")
elif 'Sign in' in page[:1000]:
    print("로그인 안 됨 — 프로필 세션 만료 또는 미로그인")
else:
    print("로그인 상태 불명확")

# COSRX 상품 페이지
print(f"\nASIN {TEST_ASIN} 로드 중...")
driver.get(f'https://www.amazon.com/dp/{TEST_ASIN}')
time.sleep(5)

# AJAX 호출
ajax_url = f'/hz/reviews-render/ajax/reviews/get/?sortBy=recent&reviewerType=all_reviews&formatType=current_format&pageNumber=1&pageSize=10&asin={TEST_ASIN}&language=en_US'
result = driver.execute_async_script('''
    var cb = arguments[arguments.length - 1];
    fetch(arguments[0], {headers: {"Accept": "text/html,*/*", "x-requested-with": "XMLHttpRequest"}, credentials: "include"})
    .then(r => r.text().then(body => cb({status: r.status, len: body.length, ok: true})))
    .catch(e => cb({error: e.toString(), ok: false}));
''', ajax_url)

print(f"AJAX status: {result.get('status')} | 응답 길이: {result.get('len',0)}")

if result.get('len', 0) > 0:
    full_result = driver.execute_async_script('''
        var cb = arguments[arguments.length - 1];
        fetch(arguments[0], {headers: {"Accept": "text/html,*/*", "x-requested-with": "XMLHttpRequest"}, credentials: "include"})
        .then(r => r.text().then(body => cb({html: body, ok: true})))
        .catch(e => cb({ok: false}));
    ''', ajax_url)
    soup = BeautifulSoup(full_result.get('html', ''), 'html.parser')
    reviews = soup.select('[data-hook="review"]')
    print(f"리뷰 수: {len(reviews)}")
    if reviews:
        title_el = reviews[0].select_one('[data-hook="review-title"] span:not(.a-icon-alt)')
        print(f"첫 번째 리뷰: {title_el.get_text(strip=True) if title_el else '제목 없음'}")
        print("SUCCESS — 리뷰 수집 가능!")
else:
    print("FAIL — 여전히 리뷰 없음 (403 또는 빈 응답)")

driver.quit()
print("완료")
