# NOW（当前事实入口）

最后更新：2026-03-04 23:11（双机同步状态脚本已落地）
负责人：zhangshuo

## 当前目标
- 保持 OpenClaw 在多群日常使用中的稳定性。
- 在保留跨群协作能力的前提下，降低超时和限频风险。

## 当前系统状态
- OpenClaw：**`2026.3.2`**（stable 最新；已完成升级后兼容修正：清理 `plugins.entries` 非必要条目，修正部分 cron 的 announce/message 混用指令）。
- Gateway：launchd 托管，监听 `127.0.0.1:18789`；进程环境已设 `TZ=Asia/Shanghai`，MemOS 注入的「当前时间」按北京时间格式化，避免教练报错星期/日期。
- 核心路由：1 个飞书机器人 + 多个群 + 按群绑定 agent；当前 agent：main、brainstorm、coding、thinking、lifecoach、fitcoach、foodcoach、imagefenxi、**buddha**（Buddha 佛法老师）、**vestcoach**（投资教练，群 ID 见 .env FEISHU_GROUP_ID_vestcoach）。
- 反思群可用性：群 `oc_e5eb757efecfb1367305c64610eb5068` 已关闭 `requireMention`，普通消息与纪要消息可直接触发 `thinking`，避免“消息到了但不接单”。
- 群路由账号兼容：所有按群绑定的 workspace 已同时配置 `accountId=main` 与 `accountId=default`，避免 Feishu 入站账号切到 default 时出现“只私信能回、群不回”。
- 会议纪要接入：群 `oc_5d9a4e9670c5a94ca916484b52cd9f93` 已绑定到 `thinking`，且该群 `requireMention` 关闭，纪要机器人消息可直接进入人生导师会话。
- 跨群 agent 通信（`sessions_spawn`）：可用。
- **规划教练每晚 23:00**：cron 触发 lifecoach 读「今日执行日志」+ 30 天计划，生成明日动态时间表，发规划群并写入 `.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`（**文件名必须为明日日期**）；文件内容**必须**含「时间|任务」Markdown 表格供番茄钟解析（见 life-schedule-coach Skill）。**23:05 脚本兜底**：launchd 跑 `scripts/lifecoach-plan-fallback.js --tomorrow`，从 session 取最后一条计划写入明日文件，避免模型漏写。
- **数据路径策略（已切换）**：`daily_summary`、`30day`、`rules`、`task_events` 已并入 `.openclaw/workspace-lifecoach/data/personalos/`，教练链路优先读仓库内路径（read 优先，必要时 exec 兜底），不再依赖 `~/personalOS` 作为主路径。
- **Docker 并行部署模板**：根目录已提供 `Dockerfile` + `docker-compose.yml`（`18790 -> 18789`）+ `docker/entrypoint.sh` + `.env.docker.example`，用于在工作机与现有 OpenClaw 实例隔离共存。
- **正式群已切换**：测试群 `oc_5e2c2436f0a15c2927273d84350b2eb7` 专用路由已移除，当前按项目既有正式群绑定运行。
- **Feishu 提及策略（当前）**：全局 `channels.feishu.requireMention` 为 `true`；规划群 `oc_b0f512c3328263b70ff9772c8288099f` 显式 `requireMention: false`，避免 @ 识别导致漏触发。
- **Feishu 提及策略补齐**：饮食群 `oc_d58072ebeb9a73604d17118e5f9bf01b` 已显式 `requireMention: false`，避免正式群切换后个别群仍按强制 @ 拦截。
- **Feishu 连接模式（当前）**：Docker 实例仅启用 `main` 账号连接（`main.enabled=true`、`default.enabled=false`）；`dmPolicy=open` + `allowFrom=["*"]`，用户反馈私信已恢复。
- **双机同步（当前）**：已启用 `launchd` 自动拉（每 10 分钟）`ai.openclaw.git-auto-pull`，脚本为 `scripts/git-auto-pull-safe.sh`；策略为「自动 pull、手动 push」，并在 dirty/ahead/diverged 场景自动跳过（日志：`.openclaw/state/logs/git-auto-pull.log`）。
- **同步状态检查（当前）**：可运行 `bash scripts/git-sync-status.sh` 一次性查看 `Worktree`、`Ahead/Behind`、自动拉任务 loaded 状态与最近一次自动拉结果，便于跨设备开工前自检。
- **Cron**：共 **39 条**（规划教练 1、人生导师周/月复盘 2、饮食干预 36）；均为飞书群投递（feishu + oc_xxx）。v2026.2.24 已优化 announce 投递与重试；改 schedule 后需 `./scripts/oc gateway restart`。列表/删/改：`./scripts/oc cron list|rm|edit`。
- **Cron 监控**：Healthchecks 本地部署在 `healthchecks/`，http://localhost:8000；cron/定时任务可发 ping 到该地址，超时未收到则告警，详见 healthchecks/README.md。
- **Heartbeat**：**lifecoach** 与 **foodcoach** 均 **每 60 分钟**，且设 **静默时段** `activeHours: 07:00～24:00 (Asia/Shanghai)`（00:00～07:00 不触发）。**lifecoach**：`target: "none"`，发群仅靠 message 工具向规划群发一条；读当日 `daily_summary` + `tomorrow_plan` 对比偏离度，有 `skip_reason` 必须用 message 工具发群；heartbeat 日志必须追加到文件末尾（HEARTBEAT.md）。**foodcoach**：`target: "feishu"` + `to: "oc_群ID"`；读 30day、MEMORY、近期 memory 做轻量判断，按需发群或 HEARTBEAT_OK。Gateway 若报「Feishu account default not configured」：config 已加 `accounts.default`，需重启 Gateway。（原 120 分钟兜底脚本已停用并移除。）

## 当前模型配置
- 主链路：`minimax -> qwen -> deepseek`（`minimax/MiniMax-M2.5 -> qwen/qwen3.5-plus -> deepseek/deepseek-chat`）。
- `fitcoach` 主模型：`minimax/MiniMax-M2.5`。
- MiniMax provider 使用国内端点：`https://api.minimaxi.com/anthropic`。

## 当前记忆策略
- OpenClaw MemOS 插件参数（扩容后）：
  - `recallGlobal: true`
  - `memoryLimitNumber: 8`（每次 recall 返回 8 条 facts）
  - `preferenceLimitNumber: 3`（每次 recall 返回 3 条 preferences）
  - `includeAssistant: true`（教练回复也存入 MemOS Cloud）
- **本地 MEMORY.md 已解禁**：MemOS 插件不再禁止 agent 写本地 MEMORY.md；三教练（lifecoach/fitcoach/foodcoach）在用户确认偏好/行为模式/目标数值/例外规则时会写入各自 workspace 的 MEMORY.md。Party 深挖模式 spawn 前会读各 agent MEMORY.md 摘要注入任务。
- Cursor 侧 memos 已关闭（用于减少提示词膨胀）。

## 当前风险与观察项
- **Heartbeat 默认变更（v2026.2.24）**：未显式配置时，heartbeat 投递目标从 `last` 改为 `none`。本仓库 lifecoach 已改为 `target: "none"`（发群仅 message 工具，避免整段进群）；foodcoach 仍为 `target: "feishu"` + `to: "oc_群ID"`。
- **Cron 投递一致性风险（已收敛）**：历史 `delivery.mode: "announce"` + payload 要求 message 工具的混用项已批量清理（含 `fitcoach` 与全部 `food-int-*`）；后续新增任务仍需按单通道规则配置。
- 在高并发或重负载场景下，仍可能出现 `429` 与长耗时超时。
- 提示词膨胀来源主要是自动注入上下文 + 工具输出，不仅仅是记忆摘要。
- 需继续观察轻量记忆策略调整后的稳定性。

## 接下来 3 步
1. 连续观察 24 小时：确认正式群与私信都无间歇断连、无重复回复、无异常超时。
2. 若稳定，清理临时排障备注并固化“main 单连接 + dm open”为默认运行手册。
3. 继续观察 2-3 天：重点看 cron 的 `timed out`、`announce delivery failed` 与 Feishu `reconnect` 频率。

## 更新提醒（先提醒、再决定是否更新）
- **不自动更新**：config 中未开启 `update.auto`，仅靠「提醒」再由你决定是否执行更新。
- **每 48 小时检查 + 脑暴群**：launchd 每 48 小时跑 `scripts/update-check-and-notify.js`，有更新则把**中文报告**（含「和你有什么关系」「本版核心亮点」编号+短标题+一句、「和你更相关的几点」、重大变更、更新后方案、详细条目）发到**脑暴群**；报告同时写入 `.openclaw/state/update-check-report.md`。安装：`cp scripts/ai.openclaw.update-check-notify.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/ai.openclaw.update-check-notify.plist`（需 `.openclaw/.env` 中 DEEPSEEK_API_KEY 与 send_im_message.py 可用，见 README-update-check）。
- **确认后执行**：在脑暴群回复「**确认更新**」，脑暴机器人会按 `skills/openclaw-update/SKILL.md` 执行 `openclaw update`。
- 手动检查：`node scripts/check-openclaw-update-with-relevance.js --zh`；详见 `scripts/README-update-check.md`。

## 快速恢复清单
- 先读本文件。
- 再看 `CHANGELOG-RUNNING.md` 的最新条目。
- 若遇「同样错误又犯」或「改完又坏」：看 `CLAUDE.md` 中的易错点与正确做法。
- 如果策略变更，往 `DECISIONS.md` 补 1 条记录。
- **Gateway 无响应/配置无效**：检查 LaunchAgent 是否使用本项目 config；plist 的 `EnvironmentVariables` 是否包含 `MINIMAX_API_KEY`、`DEEPSEEK_API_KEY`、`ZAI_API_KEY`、`TZ=Asia/Shanghai`（见 DECISIONS 2026-02-23、CLAUDE.md）。缺则补全后 launchctl bootout/bootstrap 再 `openclaw gateway restart`。
- **教练说错星期/日期**：确认 plist 有 `TZ=Asia/Shanghai`；MemOS 插件是否用 `formatTimeInTimezone(..., "Asia/Shanghai")` 注入当前时间（见 DECISIONS 2026-02-23）。
- **规划教练没写入 tomorrow_plan**：可手动跑 `OPENCLAW_STATE_DIR=.openclaw/state node scripts/lifecoach-plan-fallback.js --today` 或 `--date YYYY-MM-DD`；每日 23:05 有 launchd 自动兜底明日计划。改过 lifecoach workspace（SOUL/AGENTS/Skill）后跑 `node scripts/smoke-test-lifecoach-workspace.js` 做冒烟测试。
- **番茄钟读不到今日计划/任务数为 0**：计划文件必须为 `.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md` 且内容含「时间|任务」Markdown 表格（见 Skill「计划文件内容格式」）；若模型只写了列表未写表格，番茄钟会解析出 0 个任务，需补表格或让规划教练按 Skill 重新生成。
- **Heartbeat 有内容但飞书群收不到**：确认该 agent 的 heartbeat 为 `target: "none"` 时发群仅靠 message 工具；若为 `target: "feishu"` 则框架会投递。原 120 分钟兜底脚本已停用。
- **60 分钟 heartbeat 没有每小时都出日志**：Gateway 会每 60 分钟触发，但 (1) 若 err 报「Feishu account default not configured」→ 已加 `accounts.default`，重启 Gateway；(2) 模型 Connection error 时不会写 heartbeat_logs；(3) HEARTBEAT.md 日志为可选，HEARTBEAT_OK 时可能不追加。可看 `.openclaw/state/logs/gateway.err.log` 与 lifecoach session 的 assistant 是否报错。
- **foodcoach 手动 heartbeat**：饮食减重群为 **requireMention**，须在群里**先 @ 机器人**再发送 heartbeat prompt；详见 workspace-foodcoach/HEARTBEAT_LOG/README.md。（原 120 分钟兜底脚本已停用。）
- **CLI 报 device token mismatch 或 Config (cli) 与 Config (service) 不一致**：在本项目下用 openclaw 前需让 CLI 使用项目 config。**推荐**：`./scripts/oc <子命令>`（如 `./scripts/oc gateway status`）；或先 `source scripts/openclaw-env.sh` 再执行 openclaw。仍报错则 `./scripts/oc gateway token rotate` 后 `./scripts/oc gateway restart`。
- **飞书机器人无法识别图片**：在 [飞书开放平台 → 你的应用 → 权限管理](https://open.feishu.cn/app) 中开通「消息与群组」下**接收消息、获取消息内容/资源**相关权限（名称以控制台为准）；事件订阅保持 `im.message.receive_v1`。详见 `openclaw-implementation-runbook.md` 第 1.1 节「若要让机器人识别/处理图片消息」。
- **想检查 OpenClaw 是否有新版本、哪些更新与当前项目相关**：运行 `node scripts/check-openclaw-update-with-relevance.js`，会扫描项目并标出相关 release 条目与 breaking；不执行更新，见 `scripts/README-update-check.md`。
- **Healthchecks 起不来**：`cd healthchecks && docker compose ps` 看状态；需先 `createsuperuser` 才能登录，见 `healthchecks/README.md`。
- **飞书能收图但模型「不认图」**：权限和事件已开、但回复像没看到图，多半是 **OpenClaw 里当前模型未声明 vision**。需在配置里为该模型加上 `input: ["text", "image"]`（例如在 `models.providers.zai.models` 中为 glm-5 设置），或临时改用已支持 vision 的模型（如 `minimax/MiniMax-VL-01`）验证。修改后重启 Gateway。详见 runbook 同一节「若权限和事件都开了，机器人仍不认图」。
- **im:resource 已开通仍只收到 image_key**：模型看到的是 `image_key: img_xxx` 文字，说明**下载未成功**或未走下载分支。先看 Gateway 日志是否有 `feishu: failed to download` 或 `feishu: downloaded ... image`；确认事件里 `message_type` 是否为 `image`、应用是否已**发布版本**使权限生效。详见 runbook 同一节「若 im:resource 已开通仍只收到 image_key」。
