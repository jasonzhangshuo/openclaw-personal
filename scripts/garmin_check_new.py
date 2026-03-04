#!/usr/bin/env python3
"""
检测 Garmin 新活动，有新跑步/运动数据时输出格式化消息，无新数据时静默退出。
供 garmin_notify.sh 调用，exit 0 = 有新数据并已输出，exit 2 = 无新数据。
"""
import os
import sys
import json
from datetime import date, timedelta

STATE_FILE = os.path.expanduser("~/.garmin_last_activity_id")
TOKEN_DIR_CN   = os.path.expanduser("~/.garth_cn")
TOKEN_DIR_INTL = os.path.expanduser("~/.garth")

try:
    from garminconnect import Garmin, GarminConnectConnectionError
except ImportError:
    print("garminconnect 未安装", file=sys.stderr)
    sys.exit(1)


def load_last_id():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return f.read().strip()
    return ""


def save_last_id(activity_id):
    with open(STATE_FILE, "w") as f:
        f.write(str(activity_id))


def get_client(token_dir, is_cn):
    if not os.path.exists(token_dir) or not os.listdir(token_dir):
        return None
    try:
        client = Garmin(is_cn=is_cn)
        client.login(token_dir)
        return client
    except Exception:
        return None


def format_duration(s):
    if not s:
        return "-"
    h, m, sec = int(s)//3600, (int(s)%3600)//60, int(s)%60
    return f"{h}h{m:02d}m" if h else f"{m}m{sec:02d}s"


def format_pace(sec, dist_m):
    if not dist_m or dist_m < 1:
        return "-"
    ps = sec / (dist_m / 1000)
    return f"{int(ps//60)}'{int(ps%60):02d}\"/km"


SPORT_ZH = {
    "running": "跑步", "trail_running": "越野跑",
    "indoor_running": "跑步机", "cycling": "骑行",
    "walking": "步行", "hiking": "徒步", "swimming": "游泳",
    "strength_training": "力量训练", "cardio_training": "有氧训练",
    "yoga": "瑜伽", "meditation": "冥想",
}


def format_activity(a):
    sport = (a.get("activityType", {}).get("typeKey") or "").lower()
    sport_zh = SPORT_ZH.get(sport, sport or "运动")
    dt = (a.get("startTimeLocal") or "")[:10]
    name = a.get("activityName", "")
    dist_m = a.get("distance") or 0
    dist_km = dist_m / 1000
    dur = a.get("movingDuration") or a.get("duration") or 0
    avg_hr = a.get("averageHR")
    max_hr = a.get("maxHR")
    elev   = a.get("elevationGain") or 0
    cal    = a.get("calories")
    ae     = a.get("aerobicTrainingEffect")
    tl     = a.get("activityTrainingLoad")

    lines = [f"【新{sport_zh}】{dt} · {name}"]
    if dist_km > 0.05:
        lines.append(f"距离：{dist_km:.2f} km")
    if dur:
        lines.append(f"时长：{format_duration(dur)}")
    if dist_km > 0.05 and dur and sport in ("running","trail_running","walking","hiking","indoor_running"):
        lines.append(f"配速：{format_pace(dur, dist_m)}")
    if avg_hr:
        lines.append(f"心率：均 {avg_hr:.0f}" + (f" / 峰值 {max_hr:.0f} bpm" if max_hr else " bpm"))
    if elev > 1:
        lines.append(f"爬升：{elev:.0f} m")
    if cal:
        lines.append(f"消耗：{cal:.0f} kcal")
    if ae:
        lines.append(f"有氧效果：{ae:.1f} / 5.0")
    if tl:
        lines.append(f"训练负荷：{tl:.0f}")
    return "\n".join(lines)


def fetch_latest(client):
    end = date.today()
    start = end - timedelta(days=3)  # 只查最近 3 天，避免翻太多页
    acts = client.get_activities_by_date(start.isoformat(), end.isoformat())
    return acts[0] if acts else None


def main():
    last_id = load_last_id()

    # 优先中国版（更新），再试国际版
    activity = None
    for token_dir, is_cn in [(TOKEN_DIR_CN, True), (TOKEN_DIR_INTL, False)]:
        client = get_client(token_dir, is_cn)
        if not client:
            continue
        try:
            act = fetch_latest(client)
            if act:
                activity = act
                break
        except Exception as e:
            print(f"拉取失败（{'CN' if is_cn else 'INTL'}）：{e}", file=sys.stderr)

    if not activity:
        sys.exit(2)

    act_id = str(activity.get("activityId", ""))
    if act_id == last_id:
        sys.exit(2)  # 无新数据

    # 有新数据
    save_last_id(act_id)
    print(format_activity(activity))


if __name__ == "__main__":
    main()
