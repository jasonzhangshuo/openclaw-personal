#!/usr/bin/env bash
# garmin_weekly_push.sh
# 每周定时拉取 Garmin 最近 7 天运动数据，推送给 fitcoach 分析后推到飞书群
# Crontab：30 7 * * 1  （每周一 07:30）
#
# 手动测试：bash scripts/garmin_weekly_push.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 加载环境变量（openclaw 需要 OPENCLAW_CONFIG_PATH）
export OPENCLAW_CONFIG_PATH="$PROJECT_DIR/.openclaw/config"
if [ -f "$PROJECT_DIR/.openclaw/state/.env" ]; then
    set -a; source "$PROJECT_DIR/.openclaw/state/.env"; set +a
elif [ -f "$PROJECT_DIR/.env" ]; then
    set -a; source "$PROJECT_DIR/.env"; set +a
fi

LOG="$PROJECT_DIR/.openclaw/state/logs/garmin_weekly.log"

# 拉取最近 7 天运动数据（中国版，主力账号）
GARMIN_DATA=$(python3 "$SCRIPT_DIR/garmin_fetch.py" --days 7 --cn 2>&1)
if [ $? -ne 0 ]; then
    echo "$(date): Garmin 数据拉取失败：$GARMIN_DATA" >> "$LOG"
    exit 1
fi

if [ -z "$GARMIN_DATA" ] || echo "$GARMIN_DATA" | grep -q "没有运动记录"; then
    echo "$(date): 最近 7 天无运动数据，跳过推送" >> "$LOG"
    exit 0
fi

echo "$(date): 拉取到 Garmin 数据，触发 fitcoach 分析..." >> "$LOG"

# 组装消息：数据 + fitcoach 分析请求
MESSAGE="【佳明周报自动推送】

$GARMIN_DATA

---
以上是最近 7 天的佳明运动数据。结合 30 天计划，给我本周的运动建议和调整方向？"

# 触发 fitcoach 分析并推送回复到飞书 fitcoach 群（defaultTo 指向该群）
openclaw agent \
    --agent fitcoach \
    --message "$MESSAGE" \
    --deliver \
    --channel feishu

echo "$(date): fitcoach 已分析并推送到飞书群" >> "$LOG"
