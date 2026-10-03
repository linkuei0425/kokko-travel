import csv
import json
import urllib.request
import io

# 您的 Google Sheets CSV 匯出網址
SHEET_URL = "https://docs.google.com/spreadsheets/d/1S0jLsJdZtj-mdwEk4TMxiMMq9Ivrs3NvR0ha4rAiFU4/export?format=csv"

def fetch_and_process_data():
    try:
        # 1. 抓取 CSV 資料
        req = urllib.request.Request(SHEET_URL)
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            
        reader = csv.reader(io.StringIO(content))
        headers = next(reader) # 跳過標題列
        
        unique_map = {}
        
        # 2. 逐行讀取並執行去重邏輯
        for cols in reader:
            if len(cols) < 8:
                continue
                
            product = {
                "id": cols[0].strip(),
                "time": cols[1].strip(),
                "status": cols[2].strip(),
                "tag": cols[3].strip(),
                "name": cols[4].strip(),
                "price": cols[5].strip(),
                "discount": cols[6].strip(),
                "url": cols[7].strip()
            }
            
            # 排除空資料
            if not product["name"] or product["name"] == '未命名' or not product["time"]:
                continue
                
            unique_key = f"{product['time']}_{product['name']}"
            
            if unique_key not in unique_map:
                unique_map[unique_key] = product
            else:
                existing_p = unique_map[unique_key]
                # 替換邏輯：舊的是現正瘋搶，但新抓到的不是，就替換掉
                if existing_p["tag"] == '現正瘋搶' and product["tag"] != '現正瘋搶':
                    unique_map[unique_key] = product
                    
        # 3. 轉為陣列
        all_products = list(unique_map.values())
        
        # 4. 寫入 json 檔案 (不使用縮排以達到最小檔案體積)
        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(all_products, f, ensure_ascii=False, separators=(',', ':'))
            
        print(f"更新成功！共處理並產生 {len(all_products)} 筆不重複資料。")
        
    except Exception as e:
        print(f"發生錯誤: {e}")

if __name__ == "__main__":
    fetch_and_process_data()