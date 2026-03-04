# OpenClaw 更新提醒与项目相关性扫描

## 目的

- **先提醒、再决定**：只检测是否有新版本并生成报告，不自动执行更新。
- **扫描当前项目**：根据本项目的 config（agent、heartbeat、cron、feishu、plugins、模型等）打标签。
- **相关性摘要**：拉取最新版本的 release notes，标出与当前项目相关的变更（如 heartbeat、Feishu、cron、Gateway、MiniMax、breaking 等），便于你判断「这次更新对我有没有用、有没有坑」。

## 用法

```bash
# 项目根下执行（会读 .openclaw/config 与 .openclaw/state/cron/jobs.json）
node scripts/check-openclaw-update-with-relevance.js

# 相关条目以中文输出（机翻，需先能拉取到 release notes，建议配合 GITHUB_TOKEN）
node scripts/check-openclaw-update-with-relevance.js --zh

# 机器可读（JSON）
node scripts/check-openclaw-update-with-relevance.js --json

# 指定项目目录
OPENCLAW_PROJECT=/path/to/openclawxitong node scripts/check-openclaw-update-with-relevance.js
```

## 输出说明

- **当前版本 / 最新版本**：来自 config 的 `meta.lastTouchedVersion` 与 `npm view openclaw version`。
- **本项目使用**：根据 config 扫描出的标签（如 `feishu`、`heartbeat`、`cron`、`multi-agent`、`plugins`、`minimax` 等）。
- **【可能影响你的变更 / Breaking】**：release notes 中含 breaking/deprecation 等关键词的条目。
- **【与本项目相关的更新摘要】**：按关键词匹配出的、与你当前使用功能相关的变更条目。
- **拉取方式**：由脚本主动完成。先从 **npm** 取最新版本号；若有新版本，再从 **GitHub** 拉取 release notes（先试 API，若被限流或未配 token 则自动从公开发布页 HTML 抓取）。无需你手动拉取或必须配置 GITHUB_TOKEN；配了 token 时 API 成功率更高。
- **中文输出**：加参数 `--zh` 时，会将「可能影响你的变更」与「与本项目相关的更新摘要」译成中文。若环境中有 `DEEPSEEK_API_KEY`（如 `.openclaw/.env`），优先用 **DeepSeek** 翻译；否则用 MyMemory 免费 API。可配合 `--write-report=路径` 把报告写入文件。

## 每 48 小时检查 + 发脑暴群 + 确认后执行更新（推荐）

1. **定时任务**：每 48 小时跑一次检查，有更新则生成**中文报告**并发到**脑暴群**。
2. **报告内容**：当前/最新版本、为什么要更新/要不要更新、**重大更新 Breaking**、与本项目相关的更新摘要，均为中文。
3. **确认更新**：你在脑暴群**发新消息**说「**确认更新**」并 @ 机器人后，脑暴机器人会按 `skills/openclaw-update/SKILL.md` 执行 `openclaw update`（勿用「回复」某条消息，否则可能被 main 接单而不执行）。

**安装定时任务（launchd，每 48 小时）：**

```bash
# 确保 .openclaw/.env 中有 DEEPSEEK_API_KEY（用于翻译）；发群依赖 send_im_message.py，与 lifecoach 兜底脚本相同（SEND_IM_SCRIPT_DIR）
cp scripts/ai.openclaw.update-check-notify.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/ai.openclaw.update-check-notify.plist
```

- 脚本：`scripts/update-check-and-notify.js`（内部会跑 `check-openclaw-update-with-relevance.js --zh --write-report`，若有新版本则用 send_im_message.py 发到脑暴群）。
- 报告文件：`.openclaw/state/update-check-report.md`。
- 脑暴群 chat_id：`oc_f5666943630bbbb828f5d0703871cdf4`（与 config 中 brainstorm 绑定一致）。
- 若本机 node 不在 `/opt/homebrew/bin/node`，需编辑 plist 中 `ProgramArguments` 第一项为实际 node 路径。

**卸载定时任务：**

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.update-check-notify.plist
rm ~/Library/LaunchAgents/ai.openclaw.update-check-notify.plist
```

## 建议运行频率（仅手动检查时）

- **手动**：想检查时跑一次（例如每周一次，或看到社区说发版后）。
- 若已安装上述 launchd，则每 48 小时会自动检查并发脑暴群，无需再手动跑。

## 与 config 中 `update` 的关系

- 本脚本**不依赖** `.openclaw/config` 里的 `update.auto`。
- 若未开启 `update.auto`，Gateway 启动时仍会在日志里提示有新版本（仅提示，不自动安装）。
- 本脚本在「提示」基础上，额外做了**项目扫描 + release 相关性摘要**，方便你决定是否执行 `openclaw update`。

## 更新命令

- 预览会做什么：`openclaw update --dry-run`
- 执行更新（默认会重启 Gateway）：`openclaw update`
- 不重启：`openclaw update --no-restart`
- **在脑暴群**：发新消息说「确认更新」并 @ 机器人后，脑暴会代为执行 `openclaw update`（勿用「回复」某条，否则可能接到 main；见 `workspace-brainstorm/skills/openclaw-update/SKILL.md`）。
