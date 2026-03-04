#!/usr/bin/env bash
# M0 一键就绪：你只需填好 .env（至少一个 LLM Key），本脚本完成其余全部步骤。
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
CONFIG="$REPO_ROOT/.openclaw/config"
STATE_DIR="$REPO_ROOT/.openclaw/state"
WORKSPACE_MAIN="$REPO_ROOT/.openclaw/workspace-main"

# 必须已有项目环境
if [[ ! -f .env.openclaw ]]; then
  echo "错误：未找到 .env.openclaw，请在项目根目录执行： ./scripts/m0-bootstrap.sh"
  exit 1
fi
source .env.openclaw

# ---------- 唯一需要你事先做的：填 .env ----------
has_llm_key() {
  [[ -f .env ]] && grep -qE '^[A-Za-z_]+_API_KEY=.+$' .env 2>/dev/null
}
if ! has_llm_key; then
  echo "请先填写 .env（你只需提供 API Key，其余自动）："
  echo "  1) 复制： cp .env.example .env"
  echo "  2) 编辑 .env，填上至少一个 LLM Key，例如： ZAI_API_KEY=你的密钥"
  echo "  3) 重新运行： ./scripts/m0-bootstrap.sh"
  exit 1
fi

echo "[1/8] OpenClaw..."
if ! command -v openclaw &>/dev/null; then
  echo "未检测到 OpenClaw。请先安装： curl -fsSL https://openclaw.ai/install.sh | bash"
  exit 1
fi
openclaw --version

echo "[2/8] 目录与配置..."
mkdir -p "$STATE_DIR" "$WORKSPACE_MAIN"
# 确保 config 里 workspace 为绝对路径、gateway.mode 存在
if [[ -f "$CONFIG" ]]; then
  node -e "
    const fs=require('fs');
    const p='$CONFIG';
    const w='$WORKSPACE_MAIN';
    let c=JSON.parse(fs.readFileSync(p,'utf8'));
    if(c.agents&&c.agents.list&&c.agents.list[0]) c.agents.list[0].workspace=w;
    if(!c.gateway) c.gateway={};
    c.gateway.mode='local';
    if(!c.gateway.auth||!c.gateway.auth.token) c.gateway.auth={mode:'token',token:require('crypto').randomBytes(24).toString('hex')};
    fs.writeFileSync(p, JSON.stringify(c,null,2));
  " 2>/dev/null || true
else
  # 无 config 时生成最小配置
  node -e "
    const fs=require('fs');
    const r='$REPO_ROOT';
    const cfg={
      gateway:{mode:'local',auth:{mode:'token',token:require('crypto').randomBytes(24).toString('hex')}},
      agents:{list:[{id:'main',default:true,name:'Main Assistant',workspace:r+'/.openclaw/workspace-main',model:'zai/glm-5'}]},
      channels:{feishu:{enabled:true,dmPolicy:'pairing',groupPolicy:'open',accounts:{main:{appId:'REPLACE_APP_ID',appSecret:'REPLACE_SECRET',botName:'Bot'}},groups:{oc_main_test_group:{requireMention:true}}}},
      bindings:[{agentId:'main',match:{channel:'feishu',accountId:'main',peer:{kind:'group',id:'oc_main_test_group'}}}],
      plugins:{entries:{'memos-cloud-openclaw-plugin':{enabled:false},feishu:{enabled:true}}}
    };
    fs.mkdirSync(r+'/.openclaw',{recursive:true});
    fs.writeFileSync(r+'/.openclaw/config', JSON.stringify(cfg,null,2));
  "
fi

echo "[3/8] API Key 同步到 Gateway 可读位置..."
cp -f .env "$STATE_DIR/.env" 2>/dev/null || true

echo "[4/8] Gateway 认证..."
if ! openclaw config get gateway.auth.token &>/dev/null; then
  openclaw doctor --generate-gateway-token 2>/dev/null || true
fi

echo "[5/8] 飞书配置（若 .env 已填 FEISHU_* 则写入 config）..."
if [[ -f .env ]] && grep -qE '^FEISHU_APP_ID=.+$' .env 2>/dev/null; then
  node -e "
    const fs=require('fs');
    const env={};
    fs.readFileSync('$REPO_ROOT/.env','utf8').split('\n').forEach(l=>{
      const m=l.match(/^([A-Za-z_]+)=(.*)$/);
      if(m) env[m[1]]=m[2].replace(/^['\"]|['\"]$/g,'');
    });
    const p='$CONFIG';
    if(!fs.existsSync(p)){ process.exit(1); }
    let c=JSON.parse(fs.readFileSync(p,'utf8'));
    if(c.channels&&c.channels.feishu&&c.channels.feishu.accounts&&c.channels.feishu.accounts.main){
      if(env.FEISHU_APP_ID) c.channels.feishu.accounts.main.appId=env.FEISHU_APP_ID;
      if(env.FEISHU_APP_SECRET) c.channels.feishu.accounts.main.appSecret=env.FEISHU_APP_SECRET;
    }
    if(env.FEISHU_GROUP_ID_MAIN&&c.channels&&c.channels.feishu){
      c.channels.feishu.groups=c.channels.feishu.groups||{};
      c.channels.feishu.groups[env.FEISHU_GROUP_ID_MAIN]={requireMention:true};
      if(c.bindings&&c.bindings[0]&&c.bindings[0].match) c.bindings[0].match.peer.id=env.FEISHU_GROUP_ID_MAIN;
    }
    fs.writeFileSync(p, JSON.stringify(c,null,2));
  " 2>/dev/null && echo "  已从 .env 写入 FEISHU_* 到 config" || echo "  未写入（检查 .env 是否有未注释的 FEISHU_APP_ID=xxx，且无空格）"
else
  [[ -f .env ]] && echo "  跳过（.env 中未检测到 FEISHU_APP_ID=xxx，需未注释且等号后直接写值）" || true
fi

echo "[6/7] MemOS 插件（若存在）..."
if [[ -d .plugins/MemOS-Cloud-OpenClaw-Plugin ]]; then
  openclaw plugins install "$REPO_ROOT/.plugins/MemOS-Cloud-OpenClaw-Plugin" 2>/dev/null || true
fi

echo "[7/7] Gateway 安装并启动..."
# 若 launchd 已加载服务，只做 restart，避免重复 install 报「Gateway service appears loaded. Stop it first」
if launchctl list 2>/dev/null | grep -q "ai.openclaw.gateway"; then
  openclaw gateway restart
else
  openclaw gateway install --force 2>/dev/null || true
  openclaw gateway restart
fi
sleep 4
if ! openclaw gateway status 2>&1 | grep -q "RPC probe: ok"; then
  echo "警告：Gateway 未就绪，请执行 openclaw gateway status 查看"
fi

echo "[8/8] 打开 Dashboard（已带 token，无需手动粘贴）..."
TOKEN="$(openclaw config get gateway.auth.token 2>/dev/null)" || true
if [[ -n "$TOKEN" ]]; then
  open "http://127.0.0.1:18789/?token=${TOKEN}" 2>/dev/null || true
fi

echo ""
echo "M0 完成。请在浏览器中刷新 Chat 页测试回复。"
echo "若要做 M1（飞书群）：在 .env 中填写 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_GROUP_ID_MAIN 后再次运行本脚本即可自动写入 config，然后见 Runbook M1 配对与验证。"
