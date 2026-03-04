#!/usr/bin/env bash
# garmin_notify.sh
# 检测 Garmin 新运动数据，有则让 fitcoach 分析并推到飞书群
# 由 crontab 每小时调用一次

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 加载环境变量（openclaw 需要）
export OPENCLAW_CONFIG_PATH="$PROJECT_DIR/.openclaw/config"
if [ -f "$PROJECT_DIR/.openclaw/state/.env" ]; then
    set -a; source "$PROJECT_DIR/.openclaw/state/.env"; set +a
elif [ -f "$PROJECT_DIR/.env" ]; then
    set -a; source "$PROJECT_DIR/.env"; set +a
fi

# 检测新活动
ACTIVITY_DATA=$(python3 "$SCRIPT_DIR/garmin_check_new.py" 2>/dev/null)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
    # 无新数据，静默退出
    exit 0
fi

if [ $EXIT_CODE -ne 0 ] || [ -z "$ACTIVITY_DATA" ]; then
    echo "$(date): garmin_check_new.py 出错" >> "$PROJECT_DIR/.openclaw/state/logs/garmin_notify.log"
    exit 1
fi

echo "$(date): 检测到新运动数据，触发 fitcoach..." >> "$PROJECT_DIR/.openclaw/state/logs/garmin_notify.log"

# 构建发给 fitcoach 的消息
MESSAGE="我完成了一次新的运动，以下是佳明数据：

$ACTIVITY_DATA

请根据我的 30 天计划帮我分析：本次训练完成情况如何？强度是否合适？有什么需要注意的恢复或调整建议？"

# 触发 fitcoach 并把回复推到飞书 fitcoach 群（defaultTo 指向 fitcoach 群）
openclaw agent \
    --agent fitcoach \
    --message "$MESSAGE" \
    --deliver \
    --channel feishu

echo "$(date): fitcoach 已回复并推送到飞书群" >> "$PROJECT_DIR/.openclaw/state/logs/garmin_notify.log"
