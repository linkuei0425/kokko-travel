from playwright.sync_api import sync_playwright
import re
import json
import os
from datetime import datetime
import requests

# 你的專屬 Apps Script 網址
GAS_URL = os.environ.get("GAS_URL")
LAST_PERIOD_FILE = "last_period.txt"

def get_latest_bingo():
    """使用 Playwright 無頭瀏覽器前往第三方穩定來源 (Pilio) 擷取資料"""
    url = "https://www.pilio.idv.tw/bingo/list.asp"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 啟動無頭瀏覽器，連線至開獎資訊網...")
    
    try:
        with sync_playwright() as p:
            # 啟動 Chromium 無頭模式
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # 🚀 關鍵修正：將 wait_until 改為 domcontentloaded，不理會廣告腳本
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # 稍微等待 1 秒鐘，確保動態文字渲染完畢
            page.wait_for_timeout(1000)
            
            # 直接抓取整個網頁的純文字內容
            text_content = page.inner_text("body")
            browser.close()
            
            # 使用正則表達式尋找所有 9 位數期別
            period_matches = re.findall(r"期別:\s*(\d{9})", text_content)
            
            if not period_matches:
                print("❌ 在網頁中找不到期別資訊，網站結構可能已改變。")
                return None
                
            # 取第一筆 (最新一期)
            latest_period = period_matches[0]
            
            # 擷取該期別之後的 200 個字元進行分析
            start_idx = text_content.find(latest_period)
            search_area = text_content[start_idx:start_idx+200]
            
            # 抓取搜尋區域內的所有 1~2 位數字
            all_nums = re.findall(r'\b\d{1,2}\b', search_area)
            
            # 過濾並整理前 20 顆號碼
            valid_nums = []
            for n in all_nums:
                if len(n) <= 2:
                    valid_nums.append(str(n).zfill(2))
                if len(valid_nums) == 20:
                    break
                    
            if len(valid_nums) < 20:
                print(f"❌ 抓到的號碼數量不足 20 顆 (僅抓到 {len(valid_nums)} 顆)。")
                return None
                
            # 由小到大排序
            valid_nums.sort(key=int)
            numbers_str = ", ".join(valid_nums)
            
            return [latest_period, numbers_str]
            
    except Exception as e:
        print("❌ Playwright 執行時發生錯誤:", e)
        return None

def is_duplicate(period):
    if os.path.exists(LAST_PERIOD_FILE):
        with open(LAST_PERIOD_FILE, "r") as f:
            if f.read().strip() == period:
                return True
    return False

def save_last_period(period):
    with open(LAST_PERIOD_FILE, "w") as f:
        f.write(period)

def update_to_sheet(data):
    period, numbers_str = data
    print(f"準備寫入期數: {period}")
    print(f"開出號碼: {numbers_str}")
    
    payload = json.dumps(data)
    try:
        response = requests.post(GAS_URL, data=payload, headers={'Content-Type': 'application/json'}, timeout=10)
        if response.text == "Success":
            print(f"✅ 期數 {period} 已成功寫入 Google 試算表！")
            save_last_period(period)
        else:
            print("❌ 寫入失敗，Google 回傳錯誤：", response.text)
    except Exception as e:
        print("❌ 傳送至 Google 試算表時發生例外錯誤:", e)

if __name__ == "__main__":
    latest_data = get_latest_bingo()
    
    if latest_data:
        current_period = latest_data[0]
        if is_duplicate(current_period):
            print(f"ℹ️ 期數 {current_period} 剛才已經更新過了，略過本次寫入。")
        else:
            update_to_sheet(latest_data)