import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.taiwanlottery.com/",
}


def fetch_539_history(target_count: int = 120) -> list[dict]:
    """直接從台灣彩券官方 API 抓取近期今彩539開獎紀錄"""
    now = datetime.now()
    # 往前推 165 天（約 5.5 個月，今彩539 每週開 6 期，約可取得 135~140 期）
    start_dt = now - timedelta(days=165)
    start_month = start_dt.strftime("%Y-%m")
    end_month = now.strftime("%Y-%m")

    url = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result"
    params = {
        "period": "",
        "month": start_month,
        "endMonth": end_month,
        "pageNum": 1,
        "pageSize": 200,
    }

    resp = requests.get(url, params=params, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    payload = resp.json()

    raw_list = payload.get("content", {}).get("daily539Res") or []
    records = []
    seen_dates = set()

    for item in raw_list:
        raw_date = item.get("lotteryDate", "")
        if not raw_date:
            continue
        draw_date = raw_date[:10].replace("-", "/")
        if draw_date in seen_dates:
            continue

        # drawNumberSize 為大小順序排列的 5 個號碼
        nums_raw = item.get("drawNumberSize") or item.get("drawNumberAppear") or []
        if len(nums_raw) < 5:
            continue

        five_nums = sorted(int(n) for n in nums_raw[:5])
        seen_dates.add(draw_date)
        records.append({
            "period": str(item.get("period", "")),
            "date": draw_date,
            "numbers": five_nums,
            "numbers_str": [f"{n:02d}" for n in five_nums],
            "sum": sum(five_nums),
            "odd_count": sum(1 for n in five_nums if n % 2 == 1),
        })

    # 依照日期由新到舊排序並截取指定期數
    records.sort(key=lambda x: x["date"], reverse=True)
    return records[:target_count]


def calculate_stats(records: list[dict]) -> dict:
    """計算冷熱門、遺漏值、尾數熱度與拖牌關聯"""
    all_balls = [f"{i:02d}" for i in range(1, 40)]

    def count_freq(slice_records: list[dict]) -> dict[str, int]:
        counter = Counter()
        for r in slice_records:
            counter.update(r["numbers_str"])
        return {b: counter[b] for b in all_balls}

    freq_10 = count_freq(records[:10])
    freq_30 = count_freq(records[:30])
    freq_50 = count_freq(records[:50])
    freq_100 = count_freq(records[:100])

    # 目前遺漏期數（連續幾期未開出）
    omission = {}
    for ball in all_balls:
        miss = 0
        for r in records:
            if ball in r["numbers_str"]:
                break
            miss += 1
        omission[ball] = miss

    top_omission = [
        {"ball": b, "omission": m}
        for b, m in sorted(omission.items(), key=lambda x: (-x[1], x[0]))[:8]
    ]

    # 尾數熱度（近 30 期 0尾~9尾 總開出顆數）
    tail_counter = Counter({str(t): 0 for t in range(10)})
    for r in records[:30]:
        for b in r["numbers_str"]:
            tail_counter[b[-1]] += 1

    tails = [
        {"tail": f"{t}尾", "digit": str(t), "count": tail_counter[str(t)]}
        for t in range(10)
    ]
    tails.sort(key=lambda x: (-x["count"], x["digit"]))

    # 拖牌關聯分析（根據最新一期開出的5碼，統計歷史上下一期最常跟開的號碼）
    latest_balls = set(records[0]["numbers_str"])
    drag_counter = Counter()
    drag_sources = defaultdict(set)

    for i in range(1, len(records)):
        prev_draw = set(records[i]["numbers_str"])
        next_draw = records[i - 1]["numbers_str"]
        matched = latest_balls & prev_draw
        if matched:
            for nb in next_draw:
                drag_counter[nb] += len(matched)
                drag_sources[nb].update(matched)

    drag_top6 = [
        {
            "ball": ball,
            "score": score,
            "triggered_by": sorted(list(drag_sources[ball])),
        }
        for ball, score in drag_counter.most_common(6)
    ]

    # 熱門與冷門排行（以近 30 期為基準）
    sorted_by_30 = sorted(freq_30.items(), key=lambda x: (-x[1], x[0]))
    hot_30 = [{"ball": b, "count": c} for b, c in sorted_by_30[:8]]
    cold_30 = [{"ball": b, "count": c} for b, c in sorted_by_30[-8:][::-1]]

    return {
        "freq_10": freq_10,
        "freq_30": freq_30,
        "freq_50": freq_50,
        "freq_100": freq_100,
        "hot_30": hot_30,
        "cold_30": cold_30,
        "omission": omission,
        "top_omission": top_omission,
        "tails_30": tails,
        "drag_top6": drag_top6,
    }


def main():
    print("開始從台灣彩券官方 API 抓取今彩539歷史開獎紀錄...")
    records = fetch_539_history(target_count=120)
    if len(records) < 50:
        raise RuntimeError(f"抓取期數不足（僅 {len(records)} 期），API 回傳異常。")

    stats = calculate_stats(records)
    output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_analyzed": len(records),
        "latest": records[0],
        "stats": stats,
        "history": records[:100],
    }

    with open("539_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"成功抓取 {len(records)} 期資料！")
    print(f"最新一期：第 {records[0]['period']} 期（{records[0]['date']}），號碼：{records[0]['numbers_str']}")
    print("已輸出 539_data.json")


if __name__ == "__main__":
    main()