import re
import json
import time
import requests

# 1. 讀取前面已經處理過、但部分座標缺失的 HTML 檔案
with open('index_with_coords.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'const dbData = (\{.*?\});?\n', html_content, re.DOTALL)

if match:
    json_str = match.group(1)
    db_data = json.loads(json_str)

    def get_lat_lon_google(hotel_name):
        # 構造 Google Maps 搜尋網址，加上 Bangkok 提高準確度
        search_url = f"https://www.google.com/maps/search/{hotel_name} Bangkok"
        
        # 必須偽裝成一般瀏覽器，避免被 Google 直接 403 阻擋
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
        }
        
        try:
            # allow_redirects=True 讓 requests 跟隨 Google 的轉址
            response = requests.get(search_url, headers=headers, allow_redirects=True, timeout=10)
            
            # 方法一：從最終轉址的 URL 中尋找 @緯度,經度
            # 例如: https://www.google.com/maps/place/.../@13.7466,100.5393,17z/...
            url_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', response.url)
            if url_match:
                return float(url_match.group(1)), float(url_match.group(2))
            
            # 方法二：如果沒有觸發轉址，座標通常會藏在 HTML 的 meta staticmap 標籤中
            meta_match = re.search(r'center=(-?\d+\.\d+)%2C(-?\d+\.\d+)', response.text)
            if meta_match:
                return float(meta_match.group(1)), float(meta_match.group(2))
                
        except Exception as e:
            print(f"請求發生錯誤: {e}")
            
        return None, None

    # 3. 遍歷資料，只針對沒有 lat 或 lng 的飯店進行 Google Maps 爬取
    for dist_key, dist_val in db_data.items():
        for cat_key, cat_val in dist_val.get('categories', {}).items():
            for item in cat_val.get('items', []):
                
                # 檢查是否已經有座標
                if 'lat' not in item or 'lng' not in item:
                    # 優先使用英文名稱搜尋
                    full_name = item.get('name', '')
                    en_match = re.search(r'\((.*?)\)', full_name)
                    search_name = en_match.group(1) if en_match else full_name
                    
                    print(f"🔍 針對漏網之魚進行 Google 搜尋: {search_name}")
                    lat, lon = get_lat_lon_google(search_name)
                    
                    if lat and lon:
                        item['lat'] = lat
                        item['lng'] = lon
                        print(f"✅ 成功補齊 ({lat}, {lon})")
                    else:
                        print("❌ Google Maps 也找不到，建議手動確認名稱。")
                    
                    # 避免被 Google 封鎖，延遲時間設長一點
                    time.sleep(3)

    # 4. 寫回最終版本的 HTML
    new_json_str = json.dumps(db_data, ensure_ascii=False)
    new_html = html_content.replace(json_str, new_json_str)
    
    with open('new_hotel.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
        
    print("\n🎉 所有補漏作業完成！已儲存為 new_hotel.html")
else:
    print("找不到 dbData，請檢查 HTML 格式。")