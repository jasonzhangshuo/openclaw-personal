#!/usr/bin/env bash
# 确保只有本项目的 Gateway 在跑，避免飞书消息被别的 OpenClaw（如用 DeepSeek 的）接走
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
[[ -f .env.openclaw ]] && source .env.openclaw

echo "1. 停掉当前 OpenClaw Gateway（本项目）..."
openclaw gateway stop 2>/dev/null || true

echo "2. 检查是否还有别的 openclaw gateway 进程..."
if launchctl list 2>/dev/null | grep -q openclaw; then
  echo "   当前 launchd 里还有 openclaw 相关 service，列出："
  launchctl list | grep openclaw
  echo "   若上面有不是 ai.openclaw.gateway 的，请手动 unload；本项目会用 ai.openclaw.gateway。"
fi

echo "3. 把本项目 .env 再拷到 state，保证 Gateway 只用到 ZAI..."
cp -f .env .openclaw/state/.env

echo "4. 启动本项目 Gateway（使用项目 config + state/.env）..."
openclaw gateway start

echo "5. 状态..."
openclaw gateway status

echo ""
echo "接下来：在飞书里给机器人发一条消息测试。若仍出现 429 DeepSeek，说明飞书事件被别的实例接走，请确认："
echo "  - 本机没有其他 OpenClaw 在用同一飞书 app（如曾用 ~/.openclaw 配过飞书，请停掉或删掉）；"
echo "  - 其他电脑/服务器没有用同一飞书 app 连接 OpenClaw。"
