# OpenClaw 实施 Runbook（从 0 到可运行）

> 文档类型：执行手册（Runbook）
> 对应蓝图：`docs/openclaw-agentic-organization-from-zero.md`
> 目标：按 `M0 → M1 → M2 → M3` 顺序完成落地

## 0. 输入清单（先准备）

在开始前准备这些参数：

- `OPENCLAW_VERSION_BASELINE`：以 OpenClaw 官方安装文档/Releases 当前推荐版本为准
- `FEISHU_APP_ID`：例如 `cli_xxx`
- `FEISHU_APP_SECRET`：飞书应用密钥
- `GROUP_ID_MAIN`：单群测试群 ID（`oc_xxx`）
- `GROUP_ID_BRAINSTORM` / `GROUP_ID_WRITER` / `GROUP_ID_CODING`
- `MEMOS_API_KEY`
- `MEMOS_USER_ID`（建议稳定唯一，如 `dada-main`）

**飞书自动化任务通知（M1 补充）**：定时任务由 Gateway 内置 cron 管理（`openclaw cron add`），非系统 crontab；Gateway 在 macOS 上以 **launchd** 常驻。详见 Runbook「M1 补充：macOS 任务机制与飞书自动化通知」。

模型相关（建议提前确定）：

- `MODEL_ID_GLM`（示例：`zai/glm-5`）
- `MODEL_ID_QWEN`（示例：`qwen-portal/coder-model`）
- `MODEL_ID_MINIMAX`（示例：`minimax/MiniMax-M2.1`）
- `MODEL_ID_DEEPSEEK`（按你接入方式填写，例如通过 OpenRouter/LiteLLM/自定义 provider）

> 说明：本 Runbook 采用“国内模型优先”示例；最终请以你在 OpenClaw 中实际可用的 `provider/model` 为准。
>
> 可先用以下命令查看和切换可用模型：
>
> ```bash
> openclaw models list
> openclaw models set <provider/model>
> ```

---

## M0. 环境与基线确认

**推荐：一条命令 + 终端输入 API Key（最佳体验）**

在项目根执行：

```bash
./scripts/openclaw-setup.sh
```

脚本会先说明 M0 将完成的目标，若未检测到 LLM API Key 会**在终端提示你粘贴**（仅本机输入，写入 .env），然后全自动完成安装、自检，并生成 `docs/M0-report-YYYYMMDD-HHMM.md`。最后请你验证：在浏览器 Chat 发一条消息确认有回复。

**可选：先填 .env 再跑（无交互）**

1. 复制：`cp .env.example .env`，编辑 `.env` 至少填一个 LLM Key（如 `ZAI_API_KEY=你的密钥`）。
2. 执行：`./scripts/m0-bootstrap.sh`（不会提示输入，直接完成安装并打开 Dashboard）。

**首次使用前（仅一次）**：若本机未装 OpenClaw，先执行 `curl -fsSL https://openclaw.ai/install.sh | bash`。若需 MemOS 插件，在项目下执行一次 `git clone --depth 1 https://github.com/MemTensor/MemOS-Cloud-OpenClaw-Plugin.git .plugins/MemOS-Cloud-OpenClaw-Plugin`，之后脚本会自动安装。

**共享与 Cursor Skill**：项目内已包含 `.cursor/skills/openclaw-m0-m3-setup/`，用于「一条命令 + 终端输入 Key + 自检与 M0 报告」的引导流程；push 到 GitHub 后他人 clone 即可按上述一条命令完成 M0。

### M0 验收标准

- OpenClaw 可执行；Feishu（stock）与 MemOS 插件可用；Gateway 运行且 RPC 正常。
- 你在浏览器中打开 Dashboard/Chat 无 1008，且 Chat 能收到回复（说明 LLM Key 已生效）。
- 基线版本与命令输出见 `docs/M0-baseline.md`。

---

## M1. 单 Agent + 单群（先跑通闭环）

## 1.1 飞书侧最小配置

在飞书开放平台完成：

1. 创建企业自建应用
2. 开启 Bot 能力
3. 事件订阅使用长连接（WebSocket）
4. 订阅事件至少包含 `im.message.receive_v1`
5. 发布应用

**若要让机器人识别/处理图片消息**：在飞书开放平台同一应用下还需：
- **权限管理**：在「权限管理」中为应用开通「消息与群组」相关权限，至少包含**接收消息**（如 `im:message:read_as_bot` 或「获取用户发送的消息内容」）；**下载图片必须**开通 **im:resource**（获取与上传图片/文件资源），否则无法通过 `message_id` + `image_key` 调飞书接口拉取图片（接口：`GET /open-apis/im/v1/messages/{message_id}/resources/{image_key}?type=image`）。若未开通，机器人可能只收到图片标识符文字、无法看到真实图片。具体权限名称以 [飞书开放平台 → 你的应用 → 权限管理](https://open.feishu.cn/app) 为准。
- **事件**：接收消息事件（`im.message.receive_v1`）已包含文本与图片等类型，事件体里会带 `message_id` 和消息类型（如 `image`）；若未单独订阅「图片」事件，通常只需上述接收消息事件即可，重点在权限是否允许获取消息内容/资源。
- **参考实现**：可对照本地文档 `yunbot-gateway/docs/图片识别实现说明.md`（若在另一项目则为 `/Users/zhangshuo/Projects/yunbot-gateway/docs/图片识别实现说明.md`）：提取 content 中的 `image_key`（顶层或 post 富文本 `<img>`）→ 用 tenant token 调飞书资源接口下载图片二进制 → 有图时拼成多模态消息（文本 + base64 图片）并走视觉模型。OpenClaw 侧流程类似（Feishu 扩展下载后落盘为 MediaPath，再由核心按路径加载并注入）；若只收到 image_key 文字，多为下载失败，优先检查 **im:resource** 是否已开通并生效。

**若权限和事件都开了，机器人仍「不认图」**：多半是 **OpenClaw 侧** 的模型能力声明问题。OpenClaw 只有在**当前使用的模型**在配置里声明了 `input` 包含 `"image"` 时，才会把飞书下发的图片转成 base64 注入到发给 LLM 的请求里；否则只会把占位文字发给模型，模型看不到真实图片。

- **没有「有图时自动切 vision 模型」**：OpenClaw 不会在检测到图片时自动换成 4.6/VL 等；模型是按 agent 固定选好的。要识图只能把该 agent 的**主模型**设为 vision 模型（如 lifecoach 用 `zai/glm-4.6v`，fitcoach 用 `minimax/MiniMax-VL-01`）。
- **常见误区**：Z.AI 的 **GLM-5**、MiniMax 的 **M2.5** 都是**纯文本**，不支持图片；识图需用各自平台的视觉模型（Z.AI 用 `glm-4.6v`，MiniMax 用 `MiniMax-VL-01`），并在配置里为该模型设置 `input: ["text", "image"]`。给 GLM-5 发图会报 HTTP 400。
- 修改后需**重启 Gateway**。

**若 im:resource 已开通仍只收到 image_key（模型看到的是图片标识符文字）**：说明飞书事件里的图片已收到，但**下载未成功**或**未走下载分支**，导致没有 MediaPath 注入，模型只看到原始 content（含 image_key 的 JSON）。按下面顺序排查：

1. **看 Gateway 日志（具体操作）**：Gateway 由 launchd 在后台跑，日志写在项目目录下的文件里。请按顺序做：
   - 在飞书「图片分析」群里 **@ 机器人发一张图**（或只发图，看该群是否要求 @）；
   - 打开终端，进入项目目录：`cd /Users/zhangshuo/openclawxitong`；
   - 看最近日志：`tail -80 .openclaw/state/logs/gateway.log`（正常输出）或 `tail -80 .openclaw/state/logs/gateway.err.log`（错误输出）；
   - 在输出里找是否出现：`feishu: downloaded ... image`（成功）、`feishu: failed to download`（失败）、或完全没有任何「下载」「image」「media」字样（可能没进下载逻辑）。
   发一张图后立刻执行上述 `tail` 命令，把看到的几行相关日志（或「没有相关字样」）记下来，便于下一步排查。若看到 `feishu: downloaded ... image` 说明下载成功；若看到 `feishu: failed to download` 说明下载失败；若完全没有「下载」「image」「media」字样，可能没进下载分支。
2. **确认事件里的 message_type**：飞书单张图片消息的 `message_type` 应为 `"image"`，content 为 `{"image_key":"img_xxx"}`。若实际是 `post` 或其它类型，只有 `post` 会走富文本里的 `<img>` 解析；纯图消息若不是 `image` 类型，就不会触发下载。可在 Gateway 侧临时打日志 `message_type`、`content` 前 200 字符确认。
3. **下载失败时**：若日志里有「failed to download」或 SDK/HTTP 报错，重点看：403 → 权限（确认 im:resource 已勾选且**应用已发布新版本**）；404 → `message_id` 或 `file_key`（即 image_key）不正确或已过期；超时/网络 → 重试或检查网络。
4. **权限已开且已发布**：在飞书开放平台「版本管理与发布」中确认当前使用版本已包含 im:resource，否则线上不生效。

## 1.2 写入最小 `openclaw.json`

编辑 `~/.openclaw/openclaw.json`：

```json5
{
  agents: {
    list: [
      {
        id: "main",
        default: true,
        name: "Main Assistant",
        workspace: "~/.openclaw/workspace-main",
        model: "zai/glm-5",
      },
    ],
  },

  channels: {
    feishu: {
      enabled: true,
      dmPolicy: "pairing",
      groupPolicy: "open",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "replace_with_secret",
          botName: "Your Bot",
        },
      },
      groups: {
        "oc_main_test_group": { requireMention: true },
      },
    },
  },

  bindings: [
    {
      agentId: "main",
      match: {
        channel: "feishu",
        accountId: "main",
        peer: { kind: "group", id: "oc_main_test_group" },
      },
    },
  ],

  plugins: {
    entries: {
      "memos-cloud-openclaw-plugin": {
        enabled: false,
      },
    },
  },
}
```

## 1.3 启动与验证

```bash
openclaw gateway restart
openclaw gateway status
openclaw logs --follow
```

在测试群 @ 机器人发送消息，首次若出现配对码：

```bash
openclaw pairing list feishu
openclaw pairing approve feishu <CODE>
```

## M1 验收标准

- 机器人稳定收发消息
- 日志可见该群命中 `main`
- 无崩溃/无持续报错
- 同一群内多轮对话上下文正确、无错绑其他会话

## M1 补充：macOS 任务机制与飞书自动化通知

### Gateway 服务（常驻）：launchd，不是 cron

在 macOS 上，OpenClaw **Gateway 是用 launchd 安装的常驻服务**（Launch Agent），不是用系统 crontab 或 cron 来“定时拉起”的。

- `openclaw gateway install` 会安装为 **launchd** 服务，开机/登录后可自动运行。
- 等价命令：`openclaw daemon install`（gateway 与 daemon 指向同一套 launchd 配置）。
- 若遇到安装后反复重启，可参考：[macOS launchd restart-loop fix](https://clawtips.xyz/community/github-pr-13813-gateway-install-token-autogen-macos)（确保 token 已生成并写入 config/service 环境）。

### 定时任务（自动化）：Gateway 内置 cron，不是系统 cron

**定时任务**（如“每天 9 点给飞书群发提醒”）由 **OpenClaw 自带的 cron 调度器** 完成，运行在 **Gateway 进程内部**：

- 任务持久化在 `~/.openclaw/cron/jobs.json`（或 config 里 `cron.store` 指定路径），Gateway 重启不丢失。
- 使用方式：`openclaw cron add/list/run/edit/rm`，详见 [OpenClaw Cron Jobs](https://docs.openclaw.ai/cron-jobs)。
- 调度类型：`--at` 一次性、`--every` 间隔、`--cron` 五段式 cron 表达式（可带 `--tz`，如 `Asia/Shanghai`）。
- **不是** 系统的 `/usr/bin/cron` 或 crontab；只要 Gateway 通过 launchd 常驻，内部的 cron 就会按时触发。

### 飞书自动化任务通知示例

M1 跑通飞书单群后，可用 `openclaw cron add` 增加定时任务，并把结果 **announce 到飞书群**：

```bash
# 每天 9:00（上海时区）向指定飞书群发送“今日待办”类提醒
openclaw cron add \
  --name "每日飞书提醒" \
  --cron "0 9 * * *" \
  --tz "Asia/Shanghai" \
  --session isolated \
  --message "简要总结今日待办或需要提醒的事项，用一两句话。" \
  --announce \
  --channel feishu \
  --to "group:<你的飞书群ID>"

# 查看已有定时任务
openclaw cron list

# 立即跑一次（调试用）
openclaw cron run <jobId>
```

- `--to` 的格式以 OpenClaw 飞书 channel 文档为准（一般为群 ID，如 `oc_xxx` 或 `group:oc_xxx`，可先 `openclaw cron add` 时用 `--channel feishu --to <群ID>` 试一条）。
- 多 account 时可能需在 config 或 CLI 中指定 `accountId`，具体见 `openclaw cron add --help` 与 [Cron Jobs - Delivery](https://docs.openclaw.ai/cron-jobs)。

**已知限制（2026-02 实测）**：cron 的 `--channel feishu --to` 对飞书投递不稳定：`--to "oc_群ID"` 不发到群；`--to "ou_用户open_id"` 显式发私信也未收到。此前能收到私信多半是「目标未识别时回退到 last（上次会话）」所致。**官方文档**：[Cron Jobs - Delivery](https://docs.openclaw.ai/cron-jobs) 中列出的 delivery channel 仅为 `whatsapp / telegram / discord / slack / mattermost / signal / imessage / last`，**未列 feishu**，也未给出飞书 `--to` 的格式说明（Slack/Telegram 等有示例）。**权宜做法**：当前这条「测试飞书提醒」已改为 `--channel last`，先和机器人在飞书里发一条消息（私信或群内 @），再执行 `openclaw cron run <jobId>`，结果会投递到该「上次会话」；或关注官方后续对 feishu cron 投递的文档/issue。

**Dashboard 显示 ok 但飞书未收到**：说明 cron 任务执行成功，但**向飞书发送消息时失败**。查 `gateway.err.log`，若出现 `Create card failed: Access denied ... cardkit:card:write` 或 `delivery-recovery ... Request failed with status code 400`，原因是 **飞书应用未开通「发送卡片消息」权限**。处理：打开 [飞书开放平台 → 你的应用 → 权限管理](https://open.feishu.cn/app)，搜索并开通 **cardkit:card:write**（应用身份），保存后等待生效，再执行一次 `openclaw cron run <jobId>` 测试。开通后 Gateway 无需重启。

**若终端出现「Gateway service appears loaded. Stop it first」**：说明 Gateway 已由 launchd 常驻运行，**不要**再执行 `openclaw gateway`（前台启动）或 `openclaw gateway install`（会尝试注册/启动，与已加载服务冲突）。**正确做法**：改配置后只执行 `openclaw gateway restart`；要彻底停掉再用别的命令时先 `openclaw gateway stop`。项目脚本 `scripts/m0-bootstrap.sh` 已改为：检测到 launchd 已加载时只做 `restart`，不再重复 `install`，避免该报错。

**若 cron 或 CLI 频繁超时**：先检查 OpenClaw 服务状态，避免「launchd 未跑、端口被残留进程占用」导致 launchd 反复尝试启动并写满 err.log，进而拖慢 RPC。检查步骤：`openclaw gateway status`（应看到 `Runtime: running (pid xxx)`, `RPC probe: ok`）；若显示 `Service is loaded but not running` 而端口 18789 仍被占用，说明有孤儿进程，执行 `openclaw gateway stop` 后手动结束占端口进程（如 `kill $(lsof -t -i :18789)`），再 `openclaw gateway install` 由 launchd 唯一拉起。查看最近错误：`tail -50 .openclaw/state/logs/gateway.err.log`。

---

## M2. 多 Agent + 多群（分工与隔离）

## 2.1 扩展 `agents` 与 `bindings`

将 `~/.openclaw/openclaw.json` 更新为：

```json5
{
  agents: {
    defaults: {
      models: {
        "zai/glm-5": { alias: "glm" },
        "qwen-portal/coder-model": { alias: "qwen-coder" },
        "minimax/MiniMax-M2.1": { alias: "minimax" },
        // DeepSeek 按你的实际 provider/model 填写
        "your/deepseek-model-id": { alias: "deepseek" },
      },
      model: { primary: "zai/glm-5" },
    },
    list: [
      {
        id: "main",
        default: true,
        workspace: "~/.openclaw/workspace-main",
        // 这里建议替换成你的 DeepSeek 主模型
        model: "your/deepseek-model-id",
      },
      {
        id: "brainstorm",
        workspace: "~/.openclaw/workspace-brainstorm",
        model: "qwen-portal/coder-model",
      },
      {
        id: "writer",
        workspace: "~/.openclaw/workspace-writer",
        model: "zai/glm-5",
      },
      {
        id: "coding",
        workspace: "~/.openclaw/workspace-coding",
        model: "minimax/MiniMax-M2.1",
      },
    ],
  },

  channels: {
    feishu: {
      enabled: true,
      dmPolicy: "pairing",
      groupPolicy: "open",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "replace_with_secret",
          botName: "Your Bot",
        },
      },
      groups: {
        "oc_brainstorm_group_id": { requireMention: true },
        "oc_writer_group_id": { requireMention: true },
        "oc_coding_group_id": { requireMention: true },
      },
    },
  },

  bindings: [
    {
      agentId: "brainstorm",
      match: {
        channel: "feishu",
        accountId: "main",
        peer: { kind: "group", id: "oc_brainstorm_group_id" },
      },
    },
    {
      agentId: "writer",
      match: {
        channel: "feishu",
        accountId: "main",
        peer: { kind: "group", id: "oc_writer_group_id" },
      },
    },
    {
      agentId: "coding",
      match: {
        channel: "feishu",
        accountId: "main",
        peer: { kind: "group", id: "oc_coding_group_id" },
      },
    },
    {
      agentId: "main",
      match: { channel: "feishu", accountId: "main" },
    },
  ],

  plugins: {
    entries: {
      "memos-cloud-openclaw-plugin": {
        enabled: false,
      },
    },
  },
}
```

## 2.2 路由冒烟测试

改完配置后执行：

```bash
openclaw gateway restart
openclaw logs --follow
```

测试矩阵（每个群发一条 @ 机器人消息）：

- 脑暴群 → 期望 `brainstorm`
- 写作群 → 期望 `writer`
- Coding 群 → 期望 `coding`
- DM 或未绑定群 → 期望 `main`

## M2 验收标准

- 路由全部命中预期 Agent
- 会话无跨群串扰
- 模型按 Agent 生效

### M2 补充：Agent 间通信（避免三坑）

**坑一：agentToAgent 通信没开** — 已避免。在 config 中已显式开启：

```json
"tools": {
  "agentToAgent": {
    "enabled": true,
    "allow": ["main", "brainstorm", "coding", "thinking"]
  }
}
```

**spawn 派活还需单独授权**：`sessions_spawn` 允许「谁可以派给谁」由 **`agents.list[].subagents.allowAgents`** 控制（默认只允许派给自己）。已在各 agent 上配置，例如 main 可派给 coding/brainstorm：

```json
"agents": {
  "list": [
    { "id": "main", "subagents": { "allowAgents": ["brainstorm", "coding", "thinking"] }, ... },
    { "id": "brainstorm", "subagents": { "allowAgents": ["main", "coding"] }, ... },
    { "id": "coding", "subagents": { "allowAgents": ["main", "brainstorm"] }, ... },
    { "id": "thinking", "subagents": { "allowAgents": ["main"] }, ... }
  ]
}
```

**坑二：AGENTS.md 里没写团队通讯录** — 已避免。每个 Agent 的 `AGENTS.md` 已增加「👥 Team Roster」段落，列出 `agentId` 与角色，便于 `sessions_send` / `sessions_spawn` 时知道该 @ 谁。

**坑三：send vs spawn 用错场景** — 使用约定：

| 方式 | 用途 | 注意 |
|------|------|------|
| **sessions_send** | 短指令、状态同步、快速问答；消息进入对方**已有**会话上下文 | 回复只返回调用方，**不会**在飞书群发消息；若目标 Agent 之前没有飞书会话会静默建 webchat session，飞书收不到。长内容会撑爆对方上下文。 |
| **sessions_spawn** | 写脚本、跑分析、独立重活；**全新**子任务上下文，干完自动汇报 | 结果会 announce 到调用方所在频道；重活、需隔离上下文时用 spawn。 |
| **长内容** | 大段说明、日志、文档 | 先写到共享文件，send 只传**文件路径**，让对方自己读；避免 send 大段内容撑爆上下文。 |

要让目标 Agent 在飞书群直接回复用户，需通过该 Agent 的飞书会话发消息（例如 CLI 或该群内 @ 该 Agent），不能依赖 send 的回复自动发到群。

### 如何测试 Agent 互相派活（sessions_spawn）

1. **环境**：确保使用项目 config 与 state（Gateway 已用该 config 运行）：
   ```bash
   export OPENCLAW_CONFIG_PATH=/path/to/openclawxitong/.openclaw/config
   export OPENCLAW_STATE_DIR=/path/to/openclawxitong/.openclaw/state
   ```

2. **让 main 派活给 coding**（示例：让 coding 执行 ls 并回报）：
   ```bash
   openclaw agent --agent main --message "请用 sessions_spawn 派活给 coding agent，任务：用 bash 在目录 /Users/zhangshuo/openclawxitong 执行 ls -1 | head -10，回报结果。" --timeout 120
   ```

3. **预期**：main 会调用 `sessions_spawn(agentId: "coding", task: "...")`，返回 `status: "accepted"` 和 `childSessionKey`；coding 在独立子会话中执行任务，完成后结果会通过 **announce** 回传给 main 所在会话（CLI 触发时即 main 的 main 会话）。子任务转录在 `.openclaw/state/agents/coding/sessions/*.jsonl`，运行记录在 `.openclaw/state/subagents/runs.json`。

4. **若报错 `agentId is not allowed for sessions_spawn (allowed: none)`**：说明该 agent 未配置 `subagents.allowAgents`，在 config 的对应 `agents.list[]` 里加上 `"subagents": { "allowAgents": ["coding", "brainstorm"] }` 等即可。

### 真实场景测试（飞书群可见 + 项目里真实文件）

模拟「在脑暴群说一句话 → 脑暴派活给开发 → 开发在项目里创建文件 → 结果回到飞书群」：

1. **拿到脑暴群会话 ID**（用于把回复投递到该群）：
   ```bash
   openclaw sessions --json | python3 -c "
   import json,sys
   d=json.load(sys.stdin)
   for s in d.get('sessions',[]):
     k=s.get('key',''); 
     if 'brainstorm' in k and 'feishu' in k and 'group' in k:
       print(s.get('sessionId'), k)
   "
   ```
   记下输出的 `sessionId`（例如 `1113da16-3123-44a0-8d3b-d916f514a128`）和群 ID（key 里 `oc_xxx`）。

2. **向该会话发一条「派活」消息，并指定回复发到飞书群**：
   ```bash
   export OPENCLAW_CONFIG_PATH=/path/to/openclawxitong/.openclaw/config
   export OPENCLAW_STATE_DIR=/path/to/openclawxitong/.openclaw/state

   openclaw agent --agent brainstorm \
     --session-id <上一步的 sessionId> \
     --message "请用 sessions_spawn 派活给 coding agent。任务：在目录 /Users/zhangshuo/openclawxitong/scripts 下创建文件 agent-test-result.txt，内容两行——第一行「Agent 协作测试成功」，第二行当前时间（ISO 格式）。完成后把结果回报到这个会话。" \
     --deliver --reply-channel feishu --reply-to "oc_f5666943630bbbb828f5d0703871cdf4" \
     --timeout 180
   ```
   （`--reply-to` 换成你的脑暴群 ID。）

3. **可感知结果**：
   - **飞书脑暴群**：会收到 brainstorm 的「已派发给 coding」回复；几十秒后还会收到 coding 完成后的**结果通知**（spawn announce）。
   - **项目仓库**：`scripts/agent-test-result.txt` 被真实创建，内容为两行（「Agent 协作测试成功」+ 时间）。可直接 `cat scripts/agent-test-result.txt` 验证。

这样能直观感受到：**一个群里的角色（脑暴）派活给另一个角色（开发）→ 开发在项目里干活 → 结果回到同一个群**。

### M2 扩展：人生导师（thinking）与周/月复盘

**角色**：thinking = 人生导师，绑定**反思日记群**（`.env` 中 `FEISHU_GROUP_ID_thinking`，当前 config 已用 `oc_e5eb757efecfb1367305c64610eb5068`）。

**已就绪**：
- **Workspace**：`.openclaw/workspace-thinking/`，含 `SOUL.md`（人生导师人设）、`AGENTS.md`（必读 reflection-coach Skill）、`HEARTBEAT.md`（空，复盘靠 cron）。
- **Skill**：`workspace-thinking/skills/reflection-coach/SKILL.md` — 约定如何打开飞书文档深度读取、给建议与讨论、执行周/月复盘（基于本群反思与讨论记忆）。
- **Config**：agent `thinking`、binding 到该群、`tools.agentToAgent.allow` 含 `thinking`；main 的 `subagents.allowAgents` 含 `thinking`。

**定时复盘（周/月）**：复盘**不走 heartbeat**，只用 **cron + isolated 会话**（固定时间、独立任务、结果发到本群）。到点时 thinking 会按 `reflection-coach` Skill：**读取 workspace 内最近所有本地 memory**（`memory/*.md` 与 `MEMORY.md`），结合本群近期消息做总结，在群里回复主题/脉络、变化与进展、卡点、下一步建议，并把复盘结论摘要写入 `MEMORY.md`。周/月复盘任务已直接写入 `.openclaw/state/cron/jobs.json`（周复盘每周日 20:00、月复盘每月 1 日 20:00，上海时区）；若需改用 CLI 添加，示例：

```bash
# 周复盘：每周日 20:00（上海时区）
openclaw cron add \
  --name "人生导师-周复盘" \
  --cron "0 20 * * 0" \
  --tz "Asia/Shanghai" \
  --agent thinking \
  --session "agent:thinking:feishu:group:oc_e5eb757efecfb1367305c64610eb5068" \
  --message "请根据本周我在本群发送的所有反思笔记以及我们讨论过的记忆摘要，做一次本周复盘，并在群里回复：主题/脉络、变化与进展、卡点、下一步建议。" \
  --announce --channel feishu --to "oc_e5eb757efecfb1367305c64610eb5068"

# 月复盘：每月 1 日 20:00（上海时区）
openclaw cron add \
  --name "人生导师-月复盘" \
  --cron "0 20 1 * *" \
  --tz "Asia/Shanghai" \
  --agent thinking \
  --session "agent:thinking:feishu:group:oc_e5eb757efecfb1367305c64610eb5068" \
  --message "请根据本月我在本群发送的所有反思笔记以及我们讨论过的记忆摘要，做一次本月复盘，并在群里回复：主题/脉络、变化与进展、卡点、下一步建议。" \
  --announce --channel feishu --to "oc_e5eb757efecfb1367305c64610eb5068"
```

若 cron 的 `--session` / `--to` 语法与当前 OpenClaw 版本不一致，以 `openclaw cron add --help` 为准。**周/月复盘任务已写入** `.openclaw/state/cron/jobs.json`，gateway 加载后即可按计划执行；thinking 群需先有过至少一条消息，以便存在对应 session。

**已知问题**：cron 任务会按时执行、thinking 会生成复盘，但 **announce 投递到飞书群常因 15s 超时失败**（`Subagent completion direct announce failed: gateway timeout after 15000ms`），导致群里收不到。**临时方案**：在复盘任务的 `message` 里明确要求 thinking「请在本条回复后，主动用 feishu/发消息工具把复盘内容发到本群」，让 agent 自己发到群，而不依赖 cron 的 announce delivery；或等 OpenClaw 放宽 announce 超时/修复投递。

---

### M2 扩展：lifecoach / fitcoach / foodcoach（30 天计划与教练协同）

**三个飞书群**（`.env` 中已配置，config 已绑定）：

| 群 | agentId   | 用途 |
|----|-----------|------|
| 生活工作时间规划 | lifecoach | 根据用户计划与互动动态调整时间块，与 fitcoach/foodcoach 协同 |
| 健康运动       | fitcoach  | 跑步（周六长+周一三五短）、力量（周二四），与佳明对齐 |
| 健康饮食减重   | foodcoach | 减脂餐、进餐节奏（早 9:30 前、中午轻食、17:00 健康餐） |

**计划锚点**：用户 30 天闭环计划见 `/Users/zhangshuo/personalOS/archive/docs/30day.md`（辅导员备考 + 身体 + 内容日更，约束 AI≤2h）。各 coach 的 Skill 约定以该文件为基准，结合本群记忆做动态调整。

**Workspace 与 Skill**：

- **lifecoach**：`.openclaw/workspace-lifecoach/`，Skill `skills/life-schedule-coach/SKILL.md`（时间块、与 fit/food 协同）
- **fitcoach**：`.openclaw/workspace-fitcoach/`，Skill `skills/fit-coach/SKILL.md`（跑步/力量、佳明、与 life/food 协同）
- **foodcoach**：`.openclaw/workspace-foodcoach/`，Skill `skills/food-coach/SKILL.md`（减脂餐、进餐节奏、与 life/fit 协同）

**互通**：main 的 `subagents.allowAgents` 含三者；`tools.agentToAgent.allow` 含三者；各 coach 的 `subagents.allowAgents` 含彼此，可在本群对话中委托或同步另一 coach。发消息到本群时，各 AGENTS.md 中写明了本群 ID，避免发错群。

**foodcoach 静态干预提醒（固定时间推送）**：与 **life-coach-bot** 的 `life_coach/data/interventions.json` + `scheduler.py` 逻辑对齐——**每条干预一个 cron 任务**，在对应星期与时间触发，由 **foodcoach** 读规则表、按 id 发送到飞书饮食群。

- **规则表**：`.openclaw/workspace-foodcoach/data/interventions.json`（与 `life-coach-bot/life_coach/data/interventions.json` **内容一致**：id / day（monday..sunday）/ time（HH:MM）/ type / category / message）。增删改文案或条目时，可同步更新 life-coach-bot 与 openclaw 两份，或只改 openclaw 的副本。
- **Skill**：`skills/food-coach/SKILL.md` 第四节「定时干预提醒」约定：cron 消息为「请发送干预提醒，id 为 &lt;id&gt;」时，读该 JSON、按 id 取条目的 `message`，用 message 工具发到本群（群 ID `oc_d58072ebeb9a73604d17118e5f9bf01b`）。
- **Cron 任务**（已写入 `.openclaw/state/cron/jobs.json`，上海时区）：**30 条**，与 scheduler.py 的 setup_jobs 一一对应（如周一 11:30 锻炼前、周一 17:30 最后一餐、周三 17:00 买菜、周四 7:00/11:00/11:30/16:00/17:30、周六 8:00/9:00/10:30/13:00/14:00/17:00/20:00、周日 7:00/9:00/12:00/14:00/18:00 等）。新增干预时在 `interventions.json` 增加条目并在 jobs.json 中增加一条对应 cron（expr 按 day→0–6、time→MM HH）。若用 **cron 工具**（cron.add）添加，**不要**在 job 对象里传 `id`（API 不接受，由服务端生成）。

---

## M3. 接入 MemOS（保守上线 → 灰度共享）

## 3.1 配置 MemOS 环境变量

```bash
mkdir -p ~/.openclaw
cat >> ~/.openclaw/.env <<'ENV'
MEMOS_API_KEY=replace_with_memos_api_key
MEMOS_USER_ID=replace_with_stable_user_id
ENV
```

## 3.2 启用插件并使用保守参数

在 `~/.openclaw/openclaw.json` 的插件配置中改为：

```json5
{
  plugins: {
    entries: {
      "memos-cloud-openclaw-plugin": {
        enabled: true,
        config: {
          recallEnabled: true,
          addEnabled: true,
          captureStrategy: "last_turn",
          includeAssistant: true,
          includePreference: true,
          memoryLimitNumber: 6,
          preferenceLimitNumber: 3,
          recallGlobal: false,
          timeoutMs: 5000,
          retries: 1,
        },
      },
    },
  },
}
```

重启并观察：

```bash
openclaw gateway restart
openclaw logs --follow
```

## 3.3 灰度共享（可选）

稳定运行 1~2 周后，若你确实需要跨 Agent 共享记忆：

- 将 `recallGlobal: false` 改为 `true`
- 只改这一个参数
- 继续观察 3~7 天是否出现“串味”

若出现串味：

- 立即回退为 `recallGlobal: false`
- 并把 `memoryLimitNumber` 下调（如 `6 → 4`）

## 3.4 MemOS 与「agent 之间知不知道对方在做什么」

**MemOS 是什么**：按**用户**维度的外置记忆。每次任意 agent 跑之前，插件会向 MemOS Cloud 请求「和当前用户 + 当前 query 相关的记忆」（recall），拼进 prompt；跑完后把本轮对话写入 MemOS（add）。所以 MemOS 存的是「用户在各群、各场景下发生过什么」的摘要与偏好，不是「每个 agent 的私有工作区」。

**当前状态**（本项目）：插件已启用，`recallEnabled` / `addEnabled` 为 true，`recallGlobal: true` → **全局召回**，即 main、thinking、coding、lifecoach、fitcoach、foodcoach 等都会从**同一套 MemOS 记忆**里按 query 检索。也就是说：**已经打开共享记忆**，各 agent 在回复前都能拿到「用户在其他群/场景说过什么、做过什么」的召回结果（受 memoryLimitNumber 等限制）。

**他们之间能「知道对方做什么」吗？要分两种**：

| 方式 | 能知道什么 | 说明 |
|------|-------------|------|
| **MemOS 召回** | 用户（以及之前对话里助手说过/做过的事）在其他场景的**历史** | 间接。例如 lifecoach 回复时可能召回到「用户在反思群和 thinking 讨论过睡眠」的记忆，从而「知道」用户有这件事，但**不是**实时知道「thinking 刚刚执行了哪条指令」。 |
| **agentToAgent（sessions_send / sessions_spawn）** | 对方**当前**的回复或执行结果 | 主动、实时。例如 lifecoach 发一条消息给 fitcoach：「用户这周想把周一跑改到周三，可以吗？」fitcoach 回复后，lifecoach 就「知道」了。 |

**总结**：  
- **共享记忆**：已打开（MemOS + recallGlobal true），各 agent 会间接看到「用户和相关历史」的跨场景记忆。  
- **实时知道对方在做什么**：靠**互通**（发消息给另一个 agent）或对方把结果写进 MemOS/本地 memory 后被下次召回；没有「每个 agent 动作自动广播给所有 agent」的机制。  
若希望某 agent 在做完一件事后让其他 agent 更容易看到，可让该 agent 在回复中沉淀要点到 MemOS（插件会在 add 时写入），或写到共享文件/群消息，供后续召回或人工查看。

## M3 验收标准

- 记忆召回可观察
- 无明显跨场景干扰
- token 成本与质量达到预期

---

## 4. 运维常用命令

```bash
openclaw --version
openclaw gateway status
openclaw gateway restart
openclaw gateway stop
openclaw logs --follow
openclaw pairing list feishu
openclaw pairing approve feishu <CODE>
```

---

## 4.1 版本与更新（如何知道有更新、如何保持最新）

OpenClaw 更新较频繁（尚未 1.0），建议按「更新 → 检查 → 重启」对待。

### 如何知道有更新

- **启动时提示**：Gateway 启动时会检查当前 channel 是否有新版本，并在日志中给出更新提示。若不需要可关闭：在配置中设 `update.checkOnStart: false`。
- **主动查询**：
  ```bash
  openclaw update status
  ```
  可查看当前 channel、git tag/SHA（源码安装时）以及是否有可用更新。
- **关注发布页**：<https://github.com/openclaw/openclaw/releases>（可 Watch 该仓库的 Releases）。
- **查看 npm 最新版本**：`npm view openclaw version`。

### 如何升级到最新版本

**推荐（通用）：重跑安装脚本（原地升级）**

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash
```

脚本会检测已有安装并原地升级，必要时运行 `openclaw doctor`。

**若为全局 npm/pnpm 安装：**

```bash
npm i -g openclaw@latest
# 或
pnpm add -g openclaw@latest
```

**若为源码（git）安装：**

```bash
openclaw update
```

会执行拉取、rebase、安装依赖、构建、并默认重启 Gateway。

### 升级后必做

```bash
openclaw doctor
openclaw gateway restart
openclaw health
```

### 若需固定版本（回滚或避险）

安装指定版本（将 `<version>` 换成如 `2026.2.14`）：

```bash
npm i -g openclaw@<version>
openclaw doctor
openclaw gateway restart
```

### 升级前建议备份

- 工作区：`~/.openclaw/workspace`
- 凭证：`~/.openclaw/credentials/`
- 配置：`~/.openclaw/openclaw.json`

官方更新文档：<https://docs.openclaw.ai/install/updating>

---

## 5. 回滚手册（必须有）

1. 改配置前备份：

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%Y%m%d%H%M%S)
```

2. 变更后出现异常，回滚最近备份并重启：

```bash
cp ~/.openclaw/openclaw.json.bak.<timestamp> ~/.openclaw/openclaw.json
openclaw gateway restart
```

3. 若问题来自 MemOS，优先临时关闭插件：

- `memos-cloud-openclaw-plugin.enabled` 设为 `false`
- `openclaw gateway restart`

---

## 6. 变更记录模板（建议）

每次改动后记录一条：

```md
- 日期：2026-02-14
- 变更人：
- 变更范围：agents / bindings / feishu / memos
- 具体修改：
- 变更原因：
- 验收结果：
- 是否回滚：否
```

---

## 7. 参考

### 相关文档路径（相对本仓库根目录）

1. `docs/openclaw-implementation-runbook.md` — 面向执行：从安装到联调的逐步命令手册。
2. `docs/openclaw-routing-and-agents.md` — 面向配置：`agents`、`bindings`、群路由策略与反例。
3. `docs/openclaw-memory-strategy-memos.md` — 面向记忆治理：MemOS 参数、隔离/共享策略、回滚规则。
4. `docs/openclaw-operations-checklist.md` — 面向运维：日常巡检、故障排查、上线变更与回滚流程。
5. `docs/openclaw-evaluation-metrics.md` — 面向评估：SLO、样本抽检、质量与成本看板规范。

- OpenClaw Installer：<https://github.com/openclaw/openclaw/blob/main/docs/install/installer.md>
- OpenClaw Feishu：<https://github.com/openclaw/openclaw/blob/main/docs/channels/feishu.md>
- OpenClaw 配置参考：<https://github.com/openclaw/openclaw/blob/main/docs/gateway/configuration-reference.md>
- MemOS 插件：<https://github.com/MemTensor/MemOS-Cloud-OpenClaw-Plugin>
