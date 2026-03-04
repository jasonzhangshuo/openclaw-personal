#!/usr/bin/env python3
"""
Garmin Connect 运动数据直连脚本（无需 Strava 中转）
使用 python-garminconnect 库，直接读取 connect.garmin.com 数据

首次运行需要 Garmin 账号密码，之后 token 会缓存在 ~/.garth/
用法：
  python3 scripts/garmin_fetch.py                  # 最近 7 天
  python3 scripts/garmin_fetch.py --days 30        # 最近 30 天
  python3 scripts/garmin_fetch.py --stats          # 今年统计
  python3 scripts/garmin_fetch.py --latest         # 最近一次活动
  python3 scripts/garmin_fetch.py --json           # 输出 JSON
"""
import os
import sys
import json
import getpass
import argparse
from datetime import date, timedelta

try:
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
    )
except ImportError:
    print("请先安装：pip3 install garminconnect --break-system-packages")
    sys.exit(1)

TOKEN_DIR_INTL = os.path.expanduser("~/.garth")
TOKEN_DIR_CN   = os.path.expanduser("~/.garth_cn")
ENV_PATH = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".env"))
STATE_ENV_PATH = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".openclaw", "state", ".env"))


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


def get_client(is_cn=False):
    """获取已登录的 Garmin 客户端，优先复用缓存 token"""
    TOKEN_DIR = TOKEN_DIR_CN if is_cn else TOKEN_DIR_INTL

    env = load_env(STATE_ENV_PATH)
    if not env.get("GARMIN_EMAIL"):
        env = load_env(ENV_PATH)

    email_key = "GARMIN_CN_EMAIL" if is_cn else "GARMIN_EMAIL"
    pass_key  = "GARMIN_CN_PASSWORD" if is_cn else "GARMIN_PASSWORD"
    email    = env.get(email_key) or os.getenv(email_key)
    password = env.get(pass_key)  or os.getenv(pass_key)

    # 尝试用缓存 token 登录
    if os.path.exists(TOKEN_DIR) and os.listdir(TOKEN_DIR):
        try:
            client = Garmin(is_cn=is_cn)
            client.login(TOKEN_DIR)
            return client
        except Exception:
            import shutil
            shutil.rmtree(TOKEN_DIR, ignore_errors=True)

    # 需要账号密码
    if not email:
        email = input("Garmin 账号（邮箱）：").strip()
    if not password:
        password = getpass.getpass("Garmin 密码：")

    try:
        client = Garmin(email=email, password=password, is_cn=is_cn)
        client.login()
        os.makedirs(TOKEN_DIR, exist_ok=True)
        client.garth.dump(TOKEN_DIR)
        print(f"登录成功，token 已缓存到 {TOKEN_DIR}")
        return client
    except GarminConnectAuthenticationError as e:
        print(f"账号或密码错误：{e}")
        sys.exit(1)
    except GarminConnectConnectionError as e:
        hint = "connect.garmin.cn" if is_cn else "connect.garmin.com（需 VPN）"
        print(f"连接失败，请先运行登录脚本：")
        login_script = "garmin_login_cn.py" if is_cn else "garmin_login.py"
        print(f"  python3 scripts/{login_script}")
        sys.exit(1)
    except Exception as e:
        print(f"登录失败：{e}")
        sys.exit(1)


def format_duration(seconds):
    if not seconds:
        return "-"
    h = int(seconds) // 3600
    m = (int(seconds) % 3600) // 60
    s = int(seconds) % 60
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m{s:02d}s"


def format_pace(duration_s, distance_m):
    if not distance_m or distance_m < 1:
        return "-"
    pace_s = duration_s / (distance_m / 1000)
    m = int(pace_s // 60)
    s = int(pace_s % 60)
    return f"{m}'{s:02d}\"/km"


ACTIVITY_TYPE_ZH = {
    "running": "跑步", "cycling": "骑行", "walking": "步行",
    "hiking": "徒步", "swimming": "游泳", "strength_training": "力量训练",
    "cardio_training": "有氧训练", "yoga": "瑜伽", "elliptical": "椭圆机",
    "indoor_cycling": "室内骑行", "indoor_running": "跑步机",
    "trail_running": "越野跑", "open_water_swimming": "公开水域游泳",
}


def format_activity(a):
    raw_type = (a.get("activityType", {}).get("typeKey") or "").lower()
    type_zh = ACTIVITY_TYPE_ZH.get(raw_type, raw_type or "运动")
    date_str = (a.get("startTimeLocal") or "")[:10]
    name = a.get("activityName", "")
    dist_m = a.get("distance") or 0
    dist_km = dist_m / 1000
    duration_s = a.get("duration") or a.get("movingDuration") or 0
    moving_s = a.get("movingDuration") or duration_s
    avg_hr = a.get("averageHR")
    max_hr = a.get("maxHR")
    elevation = a.get("elevationGain") or 0
    avg_speed = a.get("averageSpeed")  # m/s
    calories = a.get("calories")
    aerobic_effect = a.get("aerobicTrainingEffect")
    training_load = a.get("activityTrainingLoad")

    lines = [f"**{date_str} {type_zh}** | {name}"]
    if dist_km > 0.05:
        lines.append(f"  距离：{dist_km:.2f} km")
    if duration_s:
        lines.append(f"  时长：{format_duration(moving_s)}")
    if dist_km > 0.05 and moving_s and raw_type in ("running", "trail_running", "walking", "hiking", "indoor_running"):
        lines.append(f"  配速：{format_pace(moving_s, dist_m)}")
    if avg_hr:
        hr_str = f"  平均心率：{avg_hr:.0f} bpm"
        if max_hr:
            hr_str += f"  最大心率：{max_hr:.0f} bpm"
        lines.append(hr_str)
    if elevation and elevation > 1:
        lines.append(f"  累计爬升：{elevation:.0f} m")
    if calories:
        lines.append(f"  消耗：{calories:.0f} kcal")
    if aerobic_effect:
        lines.append(f"  有氧训练效果：{aerobic_effect:.1f}")
    if training_load:
        lines.append(f"  训练负荷：{training_load:.0f}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--stats", action="store_true")
    parser.add_argument("--latest", action="store_true")
    parser.add_argument("--json", dest="as_json", action="store_true")
    parser.add_argument("--cn", action="store_true", help="使用佳明中国版账号")
    args = parser.parse_args()

    client = get_client(is_cn=args.cn)

    if args.stats:
        today = date.today()
        data = client.get_stats(today.isoformat())
        if args.as_json:
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            print("## Garmin 今日/本周/本年统计\n")
            fields = [
                ("totalKilometers", "总里程", "km"),
                ("totalActivitySeconds", "总运动时长", "s"),
                ("totalSteps", "总步数", "步"),
                ("averageRestingHeartRate", "平均静息心率", "bpm"),
            ]
            for k, label, unit in fields:
                v = data.get(k)
                if v is None:
                    continue
                if unit == "s":
                    print(f"  {label}：{format_duration(v)}")
                else:
                    print(f"  {label}：{v} {unit}")
        return

    end_date = date.today()
    start_date = end_date - timedelta(days=args.days)

    activities = client.get_activities_by_date(
        start_date.isoformat(),
        end_date.isoformat(),
    )

    if args.latest:
        activities = activities[:1]

    if args.as_json:
        print(json.dumps(activities, ensure_ascii=False, indent=2))
        return

    if not activities:
        print(f"最近 {args.days} 天没有运动记录。")
        return

    print(f"## 最近 {args.days} 天运动记录（共 {len(activities)} 条，数据来自 Garmin Connect）\n")
    for a in activities:
        print(format_activity(a))
        print()


if __name__ == "__main__":
    main()
