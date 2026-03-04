#!/usr/bin/env bash
# OpenClaw M0 一条命令安装：启动后按提示在终端输入 LLM API Key，其余全自动；最后自检并输出 M0 报告。
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
REPORT_DIR="$REPO_ROOT/docs"
REPORT_FILE="$REPORT_DIR/M0-report-$(date +%Y%m%d-%H%M).md"

echo "=============================================="
echo "  OpenClaw M0 安装引导"
echo "=============================================="
echo ""
echo "M0 将完成："
echo "  - 检查/安装 OpenClaw、插件（Feishu + MemOS）"
echo "  - 生成配置与 Gateway，用 token 打开 Dashboard"
echo "  - 自检并生成 M0 报告"
echo ""

# 必须已有项目环境
if [[ ! -f .env.openclaw ]]; then
  echo "错误：未找到 .env.openclaw，请在项目根目录执行本脚本"
  exit 1
fi

# 若没有 .env 或没有任何 LLM Key：在终端提示输入（安全：仅在本机终端输入）
has_llm_key() {
  [[ -f .env ]] && grep -qE '^[A-Za-z_]+_API_KEY=.+$' .env 2>/dev/null
}
if ! has_llm_key; then
  if [[ -n "$ZAI_API_KEY" ]]; then
    echo "ZAI_API_KEY=$ZAI_API_KEY" >> .env
    echo "已从环境变量写入 ZAI_API_KEY 到 .env"
  else
    echo "需要至少一个 LLM 的 API Key，Chat 才能回复。"
    echo "请粘贴你的 API Key（例如 ZAI 的密钥，将保存为 ZAI_API_KEY）："
    read -r key
    if [[ -z "$key" ]]; then
      echo "未输入，退出。你可稍后编辑 .env 填写 ZAI_API_KEY=xxx 再重新运行本脚本。"
      exit 1
    fi
    mkdir -p "$REPO_ROOT"
    touch .env
    echo "ZAI_API_KEY=$key" >> .env
    echo "已写入 .env，继续安装。"
  fi
fi

# 执行 M0 自动化
echo ""
"$REPO_ROOT/scripts/m0-bootstrap.sh" || true

# 自检
echo ""
echo "---------- 自检 ----------"
source .env.openclaw 2>/dev/null || true
GATEWAY_OK=""
MODELS_OK=""
openclaw gateway status 2>&1 | grep -q "RPC probe: ok" && GATEWAY_OK="yes" || true
openclaw models list 2>&1 | grep -qE "enabled|default|primary" && MODELS_OK="yes" || true

# 请你验证
echo ""
echo "---------- 请你验证 ----------"
echo "在浏览器中打开 Dashboard Chat，发送一条消息，确认能收到回复。"
echo "若已用带 token 的 URL 打开，直接刷新 Chat 页即可。"
echo ""

# 输出 M0 报告
mkdir -p "$REPORT_DIR"
{
  echo "# M0 报告 — $(date +%Y-%m-%d\ %H:%M)"
  echo ""
  echo "## M0 目标"
  echo "- OpenClaw 可执行、版本记录"
  echo "- Feishu 与 MemOS 插件可用"
  echo "- Gateway 可用；Dashboard/Chat 可连且无 1008"
  echo "- 至少一个 LLM 可用，Chat 能回复"
  echo ""
  echo "## 完成项"
  echo "- OpenClaw 版本: $(openclaw --version 2>/dev/null || echo 'N/A')"
  echo "- Gateway: $([ -n "$GATEWAY_OK" ] && echo 'RPC 正常' || echo '需检查 openclaw gateway status')"
  echo "- 模型: $([ -n "$MODELS_OK" ] && echo '已有可用模型' || echo '需在 .env 配置 API Key')"
  echo "- 配置: $REPO_ROOT/.openclaw/config"
  echo "- Dashboard: http://127.0.0.1:18789/ （用脚本打开的带 token 链接无需再粘贴）"
  echo ""
  echo "## 请你验证"
  echo "1. 在浏览器 Chat 页发送一条消息，确认有回复。"
  echo "2. 若要做 M1（飞书群），在 .env 填写 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_GROUP_ID_MAIN 后再次运行: \`./scripts/openclaw-setup.sh\` 或 \`./scripts/m0-bootstrap.sh\`"
  echo ""
} > "$REPORT_FILE"
echo "M0 报告已写入: $REPORT_FILE"
echo ""
