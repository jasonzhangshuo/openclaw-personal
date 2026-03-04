#!/usr/bin/env python3
"""
Strava / Garmin 运动数据拉取脚本
- 自动刷新 access_token（Strava token 6小时过期）
- 输出 JSON 或格式化摘要，供 fitcoach 使用
- 支持多种查询：最近活动、今日数据、统计汇总

用法：
  python3 scripts/strava_fetch.py                      # 最近 7 天活动摘要
  python3 scripts/strava_fetch.py --days 30            # 最近 30 天
  python3 scripts/strava_fetch.py --stats              # 全量统计
  python3 scripts/strava_fetch.py --json               # 输出 JSON（给程序用）
  python3 scripts/strava_fetch.py --latest             # 仅最近一次活动
"""
import os
import sys
import json
import time
import argparse
import requests
from datetime import datetime, timedelta, timezone

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
ENV_PATH = os.path.normpath(ENV_PATH)
STATE_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".openclaw", "state", ".env")
STATE_ENV_PATH = os.path.normpath(STATE_ENV_PATH)


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def save_token_to_env(access_token, refresh_token, expires_at):
    """刷新 token 后同步写回 .env 和 state/.env"""
    for path in [ENV_PATH, STATE_ENV_PATH]:
        if not os.path.exists(path):
            continue
        with open(path) as f:
            lines = f.readlines()
        new_lines = []
        for line in lines:
            if line.startswith("STRAVA_ACCESS_TOKEN="):
                new_lines.append(f"STRAVA_ACCESS_TOKEN={access_token}\n")
            elif line.startswith("STRAVA_REFRESH_TOKEN="):
                new_lines.append(f"STRAVA_REFRESH_TOKEN={refresh_token}\n")
            elif line.startswith("STRAVA_TOKEN_EXPIRES_AT="):
                new_lines.append(f"STRAVA_TOKEN_EXPIRES_AT={expires_at}\n")
            else:
                new_lines.append(line)
        with open(path, "w") as f:
            f.writelines(new_lines)


def get_valid_token(env):
    """返回有效的 access_token，如过期则自动刷新"""
    expires_at = int(env.get("STRAVA_TOKEN_EXPIRES_AT", 0))
    now = int(time.time())

    if now < expires_at - 300:  # 提前 5 分钟刷新
        return env["STRAVA_ACCESS_TOKEN"]

    # 刷新 token
    resp = requests.post("https://www.strava.com/oauth/token", data={
        "client_id": env["STRAVA_CLIENT_ID"],
        "client_secret": env["STRAVA_CLIENT_SECRET"],
        "refresh_token": env["STRAVA_REFRESH_TOKEN"],
        "grant_type": "refresh_token",
    })
    resp.raise_for_status()
    data = resp.json()
    save_token_to_env(data["access_token"], data["refresh_token"], data["expires_at"])
    return data["access_token"]


def strava_get(token, path, params=None):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"https://www.strava.com/api/v3{path}", headers=headers, params=params)
    resp.raise_for_status()
    return resp.json()


def format_duration(seconds):
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m{s:02d}s"


def format_pace(moving_time_s, distance_m):
    """返回配速 min/km"""
    if distance_m < 1:
        return "-"
    pace_s_per_km = moving_time_s / (distance_m / 1000)
    m = int(pace_s_per_km // 60)
    s = int(pace_s_per_km % 60)
    return f"{m}'{s:02d}\"/km"


ACTIVITY_TYPE_ZH = {
    "Run": "跑步", "Ride": "骑行", "Walk": "步行", "Hike": "徒步",
    "Swim": "游泳", "WeightTraining": "力量训练", "Workout": "训练",
    "Yoga": "瑜伽", "EBikeRide": "电动骑行", "VirtualRide": "骑行（室内）",
    "VirtualRun": "跑步（室内）", "Soccer": "足球", "Tennis": "网球",
}


def format_activity(a):
    type_zh = ACTIVITY_TYPE_ZH.get(a.get("sport_type", a.get("type", "")), a.get("sport_type", a.get("type", "运动")))
    date = a["start_date_local"][:10]
    name = a.get("name", "")
    dist_km = a.get("distance", 0) / 1000
    moving_time = a.get("moving_time", 0)
    elapsed_time = a.get("elapsed_time", 0)
    avg_hr = a.get("average_heartrate")
    max_hr = a.get("max_heartrate")
    elevation = a.get("total_elevation_gain", 0)
    avg_speed = a.get("average_speed", 0)  # m/s

    lines = [f"**{date} {type_zh}** | {name}"]
    if dist_km > 0.1:
        lines.append(f"  距离：{dist_km:.2f} km")
    if moving_time:
        lines.append(f"  运动时长：{format_duration(moving_time)}")
    if elapsed_time and elapsed_time != moving_time:
        lines.append(f"  总耗时：{format_duration(elapsed_time)}")
    if dist_km > 0.1 and moving_time and type_zh in ("跑步", "步行", "徒步"):
        lines.append(f"  配速：{format_pace(moving_time, a['distance'])}")
    if avg_hr:
        lines.append(f"  平均心率：{avg_hr:.0f} bpm" + (f"  最大心率：{max_hr:.0f} bpm" if max_hr else ""))
    if elevation > 1:
        lines.append(f"  累计爬升：{elevation:.0f} m")

    # Garmin 专属字段
    suffer_score = a.get("suffer_score")
    if suffer_score:
        lines.append(f"  体能负荷（Suffer Score）：{suffer_score}")

    return "\n".join(lines)


def get_activities(token, days=7, per_page=30):
    after = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    activities = strava_get(token, "/athlete/activities", {
        "after": after,
        "per_page": per_page,
    })
    return activities


def get_stats(token, athlete_id):
    return strava_get(token, f"/athletes/{athlete_id}/stats")


def format_stats(stats):
    lines = ["## Strava 全量运动统计\n"]
    for key, label in [
        ("recent_run_totals", "最近 4 周跑步"),
        ("ytd_run_totals", "今年跑步"),
        ("all_run_totals", "全部跑步"),
        ("recent_ride_totals", "最近 4 周骑行"),
        ("ytd_ride_totals", "今年骑行"),
    ]:
        t = stats.get(key, {})
        if t.get("count", 0) == 0:
            continue
        lines.append(f"**{label}**：{t['count']} 次 | {t['distance']/1000:.1f} km | {format_duration(t['moving_time'])}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7, help="最近 N 天（默认 7）")
    parser.add_argument("--stats", action="store_true", help="输出统计汇总")
    parser.add_argument("--json", action="store_true", help="输出原始 JSON")
    parser.add_argument("--latest", action="store_true", help="仅最近一次活动")
    args = parser.parse_args()

    # 加载 env（优先读 state/.env，其次 .env）
    env = load_env(STATE_ENV_PATH)
    if not env.get("STRAVA_CLIENT_ID"):
        env = load_env(ENV_PATH)
    if not env.get("STRAVA_CLIENT_ID"):
        # 也尝试从系统环境变量
        for k in ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_ACCESS_TOKEN",
                  "STRAVA_REFRESH_TOKEN", "STRAVA_TOKEN_EXPIRES_AT", "STRAVA_ATHLETE_ID"]:
            if os.getenv(k):
                env[k] = os.getenv(k)

    required = ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_ACCESS_TOKEN",
                "STRAVA_REFRESH_TOKEN", "STRAVA_TOKEN_EXPIRES_AT"]
    missing = [k for k in required if not env.get(k)]
    if missing:
        print(f"缺少环境变量：{', '.join(missing)}", file=sys.stderr)
        print("请先运行：python3 scripts/strava_oauth.py", file=sys.stderr)
        sys.exit(1)

    token = get_valid_token(env)

    if args.stats:
        athlete_id = env.get("STRAVA_ATHLETE_ID")
        if not athlete_id:
            athlete = strava_get(token, "/athlete")
            athlete_id = athlete["id"]
        stats = get_stats(token, athlete_id)
        if args.json:
            print(json.dumps(stats, ensure_ascii=False, indent=2))
        else:
            print(format_stats(stats))
        return

    activities = get_activities(token, days=args.days)

    if args.latest:
        activities = activities[:1]

    if args.json:
        print(json.dumps(activities, ensure_ascii=False, indent=2))
        return

    if not activities:
        print(f"最近 {args.days} 天没有运动记录。")
        return

    print(f"## 最近 {args.days} 天运动记录（共 {len(activities)} 条，数据来自 Strava/Garmin）\n")
    for a in activities:
        print(format_activity(a))
        print()


if __name__ == "__main__":
    main()
