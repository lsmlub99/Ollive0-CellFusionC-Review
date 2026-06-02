"""
Amazon 로그인 최초 설정 스크립트.
한 번만 실행해서 로그인하면, 이후 파이프라인이 저장된 Chrome 프로필로 자동 로그인 상태를 유지합니다.
"""
import sys, time, os, winreg
sys.path.insert(0, '.')

import undetected_chromedriver as uc

PROFILE_DIR = os.path.join(os.path.dirname(__file__), 'chrome_profile_amazon')


def _chrome_ver():
    try:
        for hive, path in [
            (winreg.HKEY_CURRENT_USER, r'SOFTWARE\Google\Chrome\BLBeacon'),
            (winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Google\Chrome\BLBeacon'),
        ]:
            try:
                with winreg.OpenKey(hive, path) as k:
                    return int(winreg.QueryValueEx(k, 'version')[0].split('.')[0])
            except OSError:
                continue
    except Exception:
        pass
    return 148


def main():
    os.makedirs(PROFILE_DIR, exist_ok=True)

    options = uc.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-gpu')
    options.add_argument('--lang=en-US,en')
    options.add_argument('--window-size=1280,900')
    options.add_argument(f'--user-data-dir={PROFILE_DIR}')

    print(f"Chrome 프로필 경로: {PROFILE_DIR}")
    print("Amazon 홈페이지가 열립니다. 직접 로그인해주세요.")
    print("로그인 완료 후 여기서 Enter를 누르면 Chrome이 닫히고 세션이 저장됩니다.\n")

    driver = uc.Chrome(options=options, version_main=_chrome_ver())
    driver.get('https://www.amazon.com/')
    time.sleep(3)

    input("[대기 중] Amazon 로그인 완료 후 Enter 입력...")

    # 로그인 확인
    driver.get('https://www.amazon.com/')
    time.sleep(2)
    page = driver.page_source
    logged_in = ('Hello,' in page or 'account' in page.lower()[:2000])
    print("로그인 확인됨!" if logged_in else "경고: 로그인이 안 된 것 같습니다. 다시 확인해주세요.")

    driver.quit()
    print(f"\n완료. 프로필이 {PROFILE_DIR} 에 저장됐습니다.")
    print("이제 amazon_pipeline.py 실행 시 자동으로 로그인 상태가 유지됩니다.")


if __name__ == '__main__':
    main()
