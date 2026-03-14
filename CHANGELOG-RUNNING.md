# 运行流水（CHANGELOG-RUNNING）

用途：记录“实际做了什么”。保持短句、按时间顺序追加。

## 2026-03-14
[2026-03-14 10:05]
- 第一步：运行 `date` 命令获取时间，得到 `2026-03-14 10:05`。
- 第二步：复制时间到记录中。
- 第三步：记录对话内容
  - 用户反馈：“你关闭语音吧，我觉得这个影响很大啊，回复了一次，又不回复了”
  - 排查与修复过程：
    - 检查网关日志，发现 `[feishu] feishu[main]: received message from...` 进来了，但后面出现 `Gateway agent failed; falling back to embedded: Error: gateway closed` 报错。
    - 这表明网关出现了一些连接异常或者崩溃。
    - 考虑到之前的 `NO_REPLY` 机制对于框架的影响，虽然改为回复极短文字可以避开直接丢弃，但在处理纯语音时确实更容易出各种边缘问题。
    - 决定彻底取消主助手的语音偏好，恢复纯文本对话。
    - 首先，修改 `.openclaw/workspace-main/SOUL.md` 和 `CLAUDE.md`，将处理纯语音的回退方案由原来的明确短句改写为更隐蔽的零宽字符（或半角空格）占位符（虽然本次已决定不用，但保留最稳妥的保底规则）。
    - 其次，也是最核心的，通过 CLI 手动向主助手发送多条消息，让其主动在 MemOS 及其本地 `MEMORY.md` 记忆中写入“取消只发语音，恢复文本对话”的明确偏好指令。
    - 使用 `launchctl unload/load` 重启 Gateway 服务。
    - 最后，通过 CLI `openclaw agent` 命令及 `oc message send` 脚本进行后台冒烟测试，确认主助手开始正常使用纯文本进行回复，测试成功。

[2026-03-14 10:12]
- 第一步：运行 `date` 命令获取时间，得到 `2026-03-14 10:12`。
- 第二步：复制时间到记录中。
- 第三步：记录对话内容
  - 已向用户飞书发送通知消息及冒烟测试文本，告知其已彻底关闭“仅发送语音”功能，恢复纯文本回复，并提示用户重新在飞书私信尝试。
- **强化语音回复 NO_REPLY 规避机制**：更新了 `CLAUDE.md` 和 `.openclaw/workspace-main/SOUL.md`，使用“零宽字符”或“半角空格”来替代 `NO_REPLY`，以彻底避免框架在纯语音场景下识别到纯空白而错误拦截整个带有语音附件的媒体消息。
- **取消主助手纯语音偏好**：执行了 `openclaw agent` 命令让主助手记录“取消纯语音偏好”的本地记忆和 MemOS 记忆，并在后台通过私信冒烟测试确认文本回复功能已正常。
- **修复 TTS 语音回复被丢弃问题**：定位并修复了当用户要求“只发语音，不要文本”时，模型输出 `NO_REPLY` 导致整个消息（含生成的语音音频附件）被 OpenClaw 框架全部丢弃的 Bug。在 `main` 助手的 `SOUL.md` 中添加禁止使用 `NO_REPLY` 的强制规则，并添加了使用极短文本作为占位的解决办法，同步更新了 `CLAUDE.md` 防踩坑文档。
- **升级 OpenClaw 2026.3.11 -> 2026.3.12**：通过 `npm install -g openclaw@latest` 成功将 OpenClaw 升级至 `2026.3.12`。升级完成后已使用 `launchctl unload/load` 重启网关，网关状态 `Runtime: running` 且 `RPC probe: ok`。
- **冒烟测试通过**：升级后通过 `openclaw models list` 正常输出，验证了环境、网关配置正常。

## 2026-03-13
- **05:49~06:02 调度清理第一轮完成**：按人工确认删除一次性 cron `b847ab80-e609-4af7-95ac-bffca19271c7`（番茄钟提醒-自修45分钟），OpenClaw active cron 总数由 44 条降为 **43 条**。
- **卸载高噪音坏任务**：从 `~/Library/LaunchAgents/` 卸载并删除 `ai.openclaw.buddha-reply-audio-send.plist`；当前 `ai.openclaw*` LaunchAgent 保留 `gateway` 常驻 + 5 条定时任务。
- **Cron 稳定性收敛**：将全部 `foodcoach` 干预 cron 的 `timeoutSeconds` 统一调到 `120`；`fitcoach` 两条调到 `180`；`thinking` 周/月复盘调到 `300`；`vestcoach` 早盘/收盘 cron 补充“数据层不可用时立即降级输出、不要长时间重试”的硬约束，并统一为 `300` 秒。
- **修复 launchd 入口问题**：`lifecoach-plan-fallback` 的 repo/plist 与已安装 plist 改为绝对 Node 路径 `/opt/homebrew/bin/node`，并补 `HOME`/`PATH`；`garmin-notify` 与 `garmin-weekly` 的已安装 plist 改为 `/bin/bash` + 显式 `PATH`/`OPENCLAW_*` 环境。
- **修复 Garmin 脚本在 launchd 下的二进制解析**：`scripts/garmin_notify.sh` 与 `scripts/garmin_weekly_push.sh` 改为显式解析 `openclaw` 与 `python3` 绝对路径，并在脚本内导出 `OPENCLAW_CONFIG_PATH`、`OPENCLAW_STATE_DIR` 与稳定 `PATH`。
- **冒烟验证通过**：`openclaw gateway status` 返回 `Runtime: running`、`RPC probe: ok`；`launchctl list` 中剩余 `ai.openclaw*` 条目状态均为 `0`；`foodcoach`、`fitcoach`、`thinking`、`vestcoach` 均已完成一轮不发群 smoke test，其中 `vestcoach` 在 `localhost:8001` 不可用时成功走降级输出。
- **07:27 原生 Codex OAuth + GPT-5.4 切换完成**：确认当前 OpenClaw `2026.3.11` 已原生支持 `openai-codex` OAuth 与 `openai-codex/gpt-5.4`；项目默认模型与主要文本 agent 已统一切到 `gpt-5.4`，fallback 调整为 `gpt-5.3-codex -> minimax -> qwen -> deepseek`，并移除旧的 `gpt-5.2` allowlist 残留。
- **原生 OAuth 状态核验通过**：`openclaw models status --json` 显示 `openai-codex:codex-cli` OAuth profile `status: ok`，且 `thinking` / `coding` 已继承 main agent 的 auth-profiles；`openclaw agent --agent main --message "只回复：gpt54 smoke ok"` 成功返回，验证默认模型已实际切到 `gpt-5.4`。
- **07:32 fallback 继续收窄**：按最新确认将文本主链 fallback 进一步精简为仅保留 `minimax/MiniMax-M2.5` 与 `deepseek/deepseek-chat` 两条，移除 `openai-codex/gpt-5.3-codex` 与 `qwen/qwen3.5-plus` 作为 fallback 的角色；`config validate`、`gateway restart` 与 `models status --json` 已验证新链路生效。
- **07:43 修复 fitcoach 群必须 @ 才触发**：将运动教练群 `oc_ae2bbb98e9aedfa3a70e607e88a7c29e` 的 `channels.feishu.groups` 显式改为 `requireMention: false`，避免普通群消息被 `did not mention bot` 拦截。
- **配置级冒烟通过**：`openclaw config validate --json` 通过，`openclaw gateway restart` 后 `gateway status` 为 `Runtime: running`、`RPC probe: ok`；用户侧仍需在运动群发送一条普通消息做最终 E2E 验收。

## 2026-03-04
- **21:11 personalOS 并入单仓目录**：新增迁移脚本 `scripts/migrate-personalos-into-workspace.js`，将 `~/personalOS` 的 `daily_summary`、`plan_overrides`、`task_events.jsonl`、`30day.md` 迁移到 `.openclaw/workspace-lifecoach/data/personalos/`，并写入迁移标记文件 `MIGRATION-INFO.md`。
- **路径与脚本切换完成**：`lifecoach/fitcoach/foodcoach` 相关 Skill、`lifecoach` 与 `foodcoach` HEARTBEAT、`thinking` HEARTBEAT 注释、`sync-task-event.js`、`jobs.json` 三条关键 cron payload 均改为优先使用仓库内 `workspace-lifecoach/data/personalos` 路径，不再依赖 `~/personalOS`。
- **Docker 隔离部署模板落地**：新增 `Dockerfile`、`docker-compose.yml`、`docker/entrypoint.sh`、`.env.docker.example` 与 `docs/docker-openclaw.md`，默认端口映射 `18790 -> 18789`，用于与工作机现有 OpenClaw 实例并行隔离运行。
- **冒烟验证通过**：执行 `node scripts/migrate-personalos-into-workspace.js` 成功（copied=4, skipped_missing=1）；执行 `node scripts/smoke-test-lifecoach-workspace.js`（25/25 通过）；执行 `jobs.json` JSON 语法校验通过。
- **修复“仅私信可回复、群聊多 workspace 不回复”**：在 `.openclaw/config` 的 `bindings` 中为所有群路由补齐 `accountId=default`（与 `accountId=main` 对齐），并新增 `main <- feishu accountId=default` 兜底，避免消息以 default 账号进入时无法命中目标 workspace。
- **冒烟验证通过**：执行 `./scripts/oc config validate --json` 返回 `valid: true`；执行 `./scripts/oc gateway restart` 与 `./scripts/oc gateway status`，`Runtime: running`、`RPC probe: ok`；执行 `./scripts/oc agents bindings` 已看到各群同时存在 `accountId=main/default` 两套路由。
- **反思群恢复自动接单**：将反思群 `oc_e5eb757efecfb1367305c64610eb5068` 的 `channels.feishu.groups` 配置从 `requireMention: true` 改为 `{}`（不强制 @），避免纪要消息或普通消息被记录但不派发。
- **冒烟验证通过**：执行 `./scripts/oc config validate --json` 返回 `valid: true`；执行 `./scripts/oc gateway restart` 与 `./scripts/oc gateway status`，`Runtime: running`、`RPC probe: ok`。
- **22:14 Docker 测试群切换并打通**：将 Docker 灰度测试群从 `oc_96c7deac01aeb6c8868ba89b73ec012e` 切换为 `oc_5e2c2436f0a15c2927273d84350b2eb7`，同时补齐 `bindings` 的 `accountId=main/default` 双路由。
- **22:14 Feishu 链路排障完成**：排查到「主动发群可达但入站偶发不回」主要由 Feishu WS 连接重连期导致；重启容器并确认 `ws client ready` 后，日志出现 `received message -> dispatching to agent`，测试群已恢复稳定回复。
- **22:14 提及策略收敛**：将 `channels.feishu.requireMention` 恢复为 `true`，并把需要免 @ 的群改为显式 `requireMention: false`（含新测试群与既有免 @ 群），避免依赖 `{}` 的隐式行为。
- **22:25 Feishu 通道单连接稳定化**：将 `channels.feishu.accounts.main.enabled` 设为 `false`，仅保留 `default` 账号长连接收发，避免同一 App 双连接在 `main/default` 间切换导致间歇不稳定。
- **22:25 冒烟验证通过**：测试群 `oc_5e2c2436f0a15c2927273d84350b2eb7` 收到用户消息 `probe-ok-22:22` 后，网关日志完整出现 `received message -> dispatching to agent -> dispatch complete (replies=1)`。
- **22:46 正式群切换完成**：移除测试群 `oc_5e2c2436f0a15c2927273d84350b2eb7` 的专用 `bindings/groups`，恢复项目既有正式群路由；并将规划群 `oc_b0f512c3328263b70ff9772c8288099f` 调整为 `requireMention: false`，避免 @ 识别导致的误拦截。
- **22:46 私信链路修复**：将 Feishu 单连接从 `default` 切换为 `main`（`main.enabled=true`、`default.enabled=false`），同时将 `dmPolicy` 调整为 `open` 并配置 `allowFrom: ["*"]`；用户反馈私信恢复可用。
- **22:53 正式群漏拦截补齐**：将饮食群 `oc_d58072ebeb9a73604d17118e5f9bf01b` 显式调整为 `requireMention: false`；热重载后日志恢复 `received message -> dispatching to agent` 链路。
- **23:07 双机同步自动拉落地（安全模式）**：新增 `scripts/git-auto-pull-safe.sh`（仅工作区干净时 `pull --rebase`，dirty/ahead/diverged 场景自动跳过并记日志），新增 `scripts/ai.openclaw.git-auto-pull.plist`（每 10 分钟执行一次）与 `scripts/README-git-auto-pull.md`。
- **23:07 冒烟验证通过**：手动执行脚本与 `launchctl kickstart` 均成功，日志 `git-auto-pull.log` 出现预期保护分支（当前 dirty 状态显示 `skip: working tree not clean`）。
- **23:11 同步状态检查脚本落地**：新增 `scripts/git-sync-status.sh`，一条命令输出 `Worktree`、`Ahead/Behind`、自动拉任务 loaded 状态与最近一次自动拉结果；`README-git-auto-pull.md` 补充「开新对话不会触发 pull」说明与使用方法。
- **23:11 冒烟验证通过**：执行 `bash scripts/git-sync-status.sh` 输出正常（`AutoPullAgent: loaded`、`LastAutoPull` 有日志）。

## 2026-03-05
- **07:42 新增 Docker Dashboard 一键命令**：新增可执行脚本 `scripts/dashboard-docker`，自动读取 `.openclaw/config` 的 `gateway.auth.token` 并拼接 Docker 端口 URL（默认 `http://127.0.0.1:18790/#token=...`），支持 `--print` / `--host` / `--port`。
- **07:42 排障结论固化**：确认当前实例运行在 Docker（`18790 -> 18789`），`openclaw dashboard --no-open` 默认给出的 `127.0.0.1:18789` 在宿主机不可达，导致“Dashboard 打不开”误判。
- **07:42 冒烟验证通过**：执行 `scripts/dashboard-docker --print` 与 `scripts/dashboard-docker --host 127.0.0.1 --port 18790 --print` 均返回可访问 URL；`curl http://127.0.0.1:18790/?token=...` 返回 200。
- **07:45 修复 Dashboard `origin not allowed`**：在 `.openclaw/config` 的 `gateway.controlUi.allowedOrigins` 补齐 Docker 场景来源：`http://localhost:18790`、`http://127.0.0.1:18790`、`http://192.168.1.22:18790`（保留原 `18789`），并重启容器生效。
- **07:45 验证通过**：重启后日志出现 `config change requires gateway restart (gateway.controlUi.allowedOrigins)` 且 `ws client ready`；`openclaw gateway probe --url ws://127.0.0.1:18790 --token ...` 返回 `RPC: ok`。
- **07:49 修复 Dashboard `pairing required`（Docker 桥接场景）**：在 `.openclaw/config` 增加 `gateway.controlUi.dangerouslyDisableDeviceAuth: true`，解决容器内看到客户端为 `192.168.65.1` 时被判定为非本地设备而强制 pairing 的问题。
- **07:49 验证通过**：容器重载日志出现 `config change requires gateway restart (gateway.controlUi.dangerouslyDisableDeviceAuth)`，网关探测 `ws://127.0.0.1:18790` 返回 `RPC: ok`；日志不再新增同时间段的 `pairing required` 拒绝记录。
- **08:02 修复规划教练 23:00 cron 在 Docker 下超时**：更新 `lifecoach-daily-tomorrow-plan` 的 payload，改为先判断根路径（`/app` 优先，宿主机路径兜底）再读取 `daily_summary/30day` 与写 `tomorrow_plan`；同时将 `timeoutSeconds` 从 `180` 调整为 `300`。
- **08:02 冒烟验证通过（关键链路）**：手动执行 `./scripts/oc cron run lifecoach-daily-tomorrow-plan --expect-final` 返回 `ok`，`cron runs` 最新记录 `status: ok`、`deliveryStatus: delivered`，并成功生成 `.openclaw/workspace-lifecoach/data/tomorrow_plan/2026-03-06.md`。
- **08:02 现场补偿**：手动触发 lifecoach 生成当日计划，成功写入 `.openclaw/workspace-lifecoach/data/tomorrow_plan/2026-03-05.md`；`http://127.0.0.1:8766/schedule.json` 已恢复返回当日任务列表（不再为空）。

## 2026-03-03
- **接入会议纪要机器人群到人生导师**：在 `.openclaw/config` 中新增群 `oc_5d9a4e9670c5a94ca916484b52cd9f93` 的 `bindings`（路由到 `thinking`），并在 `channels.feishu.groups` 注册该群（`requireMention` 关闭，允许纪要机器人消息直接进入会话）。
- **冒烟验证通过**：执行 `./scripts/oc config validate --json` 返回 `valid: true`；执行 `./scripts/oc gateway restart` 与 `./scripts/oc gateway status`，`Runtime: running`、`RPC probe: ok`。
- **升级后兼容修正（v2026.3.2）**：确认当前版本为 `2026.3.2`，`openclaw update status --json` 显示 stable 无可用更新。
- **清理高风险插件声明**：从项目 `.openclaw/config` 的 `plugins.entries` 移除 `feishu` 与 `qwen-portal-auth`（仅保留 `memos-cloud-openclaw-plugin`），避免后续升级再次触发插件注册表校验兼容问题。
- **修正 cron 投递指令冲突**：将 `lifecoach-daily-tomorrow-plan` 与 `fitcoach-after-noon-exercise` 的 payload 文案改为「直接输出给框架 announce 投递」，去掉“再调用 message 工具发群”的要求，减少双投递/超时风险。
- **冒烟验证**：执行 `openclaw config validate --json` 通过；执行 `openclaw gateway restart` 重载配置；手动触发 `openclaw cron run fitcoach-after-noon-exercise --expect-final --timeout 180000` 返回 `ok`，`openclaw cron runs` 显示该任务本次 `status: ok`、`deliveryStatus: delivered`。
- **批量清理 announce/message 混用**：继续将 `fitcoach-after-sat-longrun` 与全部 `foodcoach` 干预 cron（`food-int-*`）payload 统一为「直接输出，由框架 announce 投递」，不再要求 message 工具二次发群。
- **二次冒烟验证通过**：`openclaw cron run fitcoach-after-sat-longrun --expect-final` 与 `openclaw cron run food-int-mon_pre_exercise --expect-final` 均返回 `ok`；`openclaw cron runs` 最近记录均为 `status: ok`、`deliveryStatus: delivered`。
- **22:54 tomorrow_plan 迁移到 workspace 内**：新增目录 `.openclaw/workspace-lifecoach/data/tomorrow_plan/`，已将 `personalOS/data/tomorrow_plan/` 现有历史计划文件（2026-02-23 ~ 2026-03-02）复制进新目录；lifecoach/fitcoach 的 SOUL、Skill、HEARTBEAT、cron payload 与 `scripts/lifecoach-plan-fallback.js` 全量改为新路径，避免再次触发 workspace 沙箱越界。
- **22:54 迁移冒烟通过**：`node scripts/smoke-test-lifecoach-workspace.js`（25/25 通过）与 `jobs.json` JSON 语法校验通过。
- **22:58 外部数据读取改为 exec**：为保证读取 `personalOS` 目录稳定，lifecoach/fitcoach 的 Skill 与 HEARTBEAT 统一改为「对 `/Users/zhangshuo/personalOS/...` 路径优先 `exec + cat` 读取」，包括 `daily_summary`、`30day`、`rules`；并同步更新 `jobs.json` 三条相关 cron payload 文案，明确执行日志读取用 exec。
- **22:58 再次冒烟通过**：`node scripts/smoke-test-lifecoach-workspace.js`（25/25 通过）与 `jobs.json` 语法校验通过。

## 2026-02-28
- **修复 Agent 间通信失败 + 模型 fallback 链调整**：① 排查 lifecoach↔fitcoach `sessions_spawn` "所答非所问"根因：MiniMax 临时 401 + GLM-5 余额不足 → 框架 failover 时 prompt 被替换为 "Continue where you left off"，子 agent 丢失原始任务。② Gateway plist 补齐 API key 环境变量（MINIMAX_API_KEY、QWEN_API_KEY、DEEPSEEK_API_KEY、MOLTBOOK_API_KEY、TZ=Asia/Shanghai）——之前 plist 里没有 API key，重启后进程丢失所有 key。③ 用 Qwen 3.5 Plus（coding endpoint `coding.dashscope.aliyuncs.com/v1`）替换余额为零的 ZAI/GLM-5 作为第一备选。④ .env 中 `qwen3.5-plus-api-key` 改为合法环境变量名 `QWEN_API_KEY`。⑤ config 中全局替换 `zai/glm-5` → `qwen/qwen3.5-plus`，新增 qwen3.5-plus 模型定义。⑥ 验证通信：lifecoach→fitcoach `sessions_spawn` 成功，fitcoach 回复内容切题。
- **修复 lifecoach write personalOS 路径报错**：write/edit 工具受 workspace 沙箱限制，写 `/Users/zhangshuo/personalOS/data/` 报 "Path escapes workspace root"。尝试软链接方案但框架检测 symlink 逃逸也会拒绝。最终方案：Skill 中明确指引模型用 `exec`（`cat > 路径 << 'EOF'`）写 personalOS 文件，验证通过。
- **重写 .cursor/rules/openclaw-heartbeat-cron.mdc（全局规则）**：① 修正「Heartbeat = 只做简单巡查」的错误简化——正确认知是每个 workspace 的 HEARTBEAT.md 可定义完全不同的复杂行为，唯一约束是不能保证精确时间。② 去除 vestcoach 专属内容，改为全局通用。③ 纳入 CLAUDE.md 中所有历史 heartbeat/cron 易错点（5 条）：在 HEARTBEAT.md 写时间判断、改 cron 忘重启、target feishu 整段进群、accounts 缺 default、HEARTBEAT.md 全注释被跳过。④ 新增「新建 Agent 调度 Checklist」。⑤ 在 changelog-decisions-now.mdc 中加入「调度相关开发必读 heartbeat-cron.mdc」触发项。
- **vestcoach HEARTBEAT.md 架构修正（Cron vs Heartbeat）**：HEARTBEAT.md 从「heartbeat 自行判断时段」重构为正确架构：明确标注早上开场（第 2 节）由 Cron 08:30 触发、收盘复盘（第 3 节）由 Cron 16:30 触发、盘中异常监控（第 4 节）由 Heartbeat 每 30m 触发。移除「判断当前时段」逻辑。AGENTS.md 增加「调度架构」表格并更新数据层状态。
- **vestcoach Day 1 内容修复**：① 清除测试账户（account_id=21）遗留的腾讯 0700.HK 假持仓（开发时测试买入），避免 heartbeat 误判为「首次买入后第一天」。② 重写 HEARTBEAT.md 的开场逻辑：新增 1.1 阶段判断（先读 MEMORY.md 判断适应期/观察期/实践期/独立期，再选场景）；适应期 Day 1-3 有专用场景表（Day 1 认识市场+带读新闻、Day 2 认识账户、Day 3 看一只股票），不依赖持仓数据；有持仓场景仅 Day 4+ 适用。③ 重新设计「今日一课」：禁止百科式概念定义，改为「带用户做一件事」（带读新闻、带看个股、带看指标、带做思考），每次必须包含真实数据+一个小任务。④ 收盘复盘增加适应期专用结构（观察式复盘 vs 实战式复盘）。⑤ SKILL.md 数据层状态更新为已就绪；增加「质量红线」与适应期 Day 1-3 内容说明。⑥ MEMORY.md 重置知识点 1 和习惯 1/3 为未掌握。⑦ heartbeat_log 重置为未执行。
- **更新报告排版与「本版核心亮点」**：检查脚本 `check-openclaw-update-with-relevance.js` 对齐「人家」风格：① 解析 release body 区分 **Changes** / **Fixes**，取 Changes 前 6 条作为「本版核心亮点」素材。② 报告结构：一 和你有什么关系 → **二 本版核心亮点**（编号 + 短标题 + 一句，由 DeepSeek 生成；无 API 时回退为英文前 80 字）→ 三 和你更相关的几点 → 四 重大变更 → 五 更新后方案 → 六 详细相关条目。③ DeepSeek 摘要增加 `coreHighlights`（title + oneLine），语气可带一点「爽感」、不堆技术黑话。
- **OpenClaw 更新：48 小时定时检查 + 脑暴群提醒 + 确认后执行**：① 定时：launchd 每 48 小时跑 `scripts/update-check-and-notify.js`，内部执行检查脚本（中文报告，优先 DeepSeek 翻译），报告写入 `.openclaw/state/update-check-report.md`；若有新版本则通过 send_im_message.py 发到脑暴群（chat_id oc_f5666943630bbbb828f5d0703871cdf4）。② 脑暴 Skill：`workspace-brainstorm/skills/openclaw-update/SKILL.md`，用户在本群说「确认更新」后，脑暴机器人按 Skill 执行 `openclaw update`（仅确认后才执行）。③ 检查脚本支持 `--write-report=路径` 与 `DEEPSEEK_API_KEY` 优先翻译。④ plist：`scripts/ai.openclaw.update-check-notify.plist`，安装见 `scripts/README-update-check.md`。发群依赖 SEND_IM_SCRIPT_DIR（同 lifecoach 兜底）。
- **OpenClaw 更新提醒机制（先提醒、再决定）**：不启用 config 的自动更新；新增 `scripts/check-openclaw-update-with-relevance.js`：检测是否有新版本 → 扫描当前项目（heartbeat、cron、feishu、多 agent、插件、模型等）→ 拉取 release notes 并标出与项目相关的条目与可能的 breaking，便于判断是否执行更新。用法与定时建议见 `scripts/README-update-check.md`；NOW 已增加「更新提醒」小节与快速恢复入口。

## 2026-02-27
- **脑暴群仍不回复（模型未调 message 工具）**：日志确认框架向脑暴群投递报 400（Invalid ids: group:oc_f5666943630bbbb828f5d0703871cdf4），且 session 显示 agent 只输出了文字、未调用 message 工具，故用户收不到。已强化 workspace-brainstorm：SOUL 改为「禁止只输出文字」「每次回复必须先调用 message 工具」并写明流程；AGENTS.md 的 Group Chats 下增加「本群回复方式」提醒。请到脑暴群重新 @ 测试；若仍不调工具可考虑换模型或再强化 prompt。
- **脑暴群「突然好了一下又不回复」**：① 已加 `REPLY_TO_GROUP.md` 并写入 AGENTS「Every Session」第一步，SOUL 首行强调「回复必守」+ message 工具 + chat_id，强制每次回复都走 message 工具。② 若仍不回复，可能是整轮失败（401/429/超时）：err.log 仍有 401/429/timeout，需确认 plist 已带齐 API keys 且 Gateway 已重启；brainstorm 当前用 deepseek，可观察是否该模型限频或超时导致。
- **停用两个 120 分钟 heartbeat 兜底脚本**：lifecoach-heartbeat-send 与 foodcoach-heartbeat-send 已从 launchctl 卸载，并删除 `~/Library/LaunchAgents/` 下对应 plist。NOW、HEARTBEAT.md、HEARTBEAT_LOG/README、healthchecks/README 已更新为「已停用」；脚本与 plist 仍保留在 `scripts/` 仅供参考。
- **规划教练 + 饮食教练**：① 规划教练 heartbeat 写日志时报「Path escapes workspace root: personalOS/data/heartbeat_logs」，因 OpenClaw 限制 fs 不写出 workspace。已改为写**本 workspace 内** `data/heartbeat_logs/YYYY-MM-DD.md`（绝对路径见 HEARTBEAT.md），并新建该目录；120 分钟兜底脚本的 plist 增加 `HEARTBEAT_LOGS_DIR` 指向同一路径，脚本从 workspace 读日志发群。② 饮食教练读 `memory/2026-02-27.md` 时报 ENOENT，已新建该文件避免 read 失败。若已加载 lifecoach-heartbeat-send plist，需 `cp scripts/ai.openclaw.lifecoach-heartbeat-send.plist ~/Library/LaunchAgents/` 后 `launchctl bootout` + `bootstrap` 使新 env 生效。
- **机器人不回复（已恢复）**：日志报 `HTTP 401 authentication_error: invalid api key`、`tenant_access_token undefined`。根因：LaunchAgent plist 的 `EnvironmentVariables` 未包含 config 引用的 `MINIMAX_API_KEY`、`DEEPSEEK_API_KEY`、`ZAI_API_KEY`，Gateway 在 launchd 下拿不到 key 导致模型 401、飞书发回失败。已向 `~/Library/LaunchAgents/ai.openclaw.gateway.plist` 补全上述三 key 及 `TZ=Asia/Shanghai`，执行 launchctl bootout + bootstrap 并确认 Gateway RPC probe ok。若以后改 .env 或 config 引用新变量，需同步写入 plist 并重启（见 CLAUDE.md）。
- **vestcoach 群不回复**：投资教练群 `oc_f08d41bfb84e07670be80e0c8f488558` 原为 `requireMention: true`，未 @ 机器人则不触发。已去掉该群的 requireMention，改为与 groupPolicy 一致（open），发消息即可触发。改后需 `openclaw gateway restart`。
- **vestcoach 与全员打通**：config 中 fitcoach 的 allowAgents 补上 vestcoach；所有 workspace 的 AGENTS.md 通讯录表格均加入 vestcoach 一行（main、lifecoach、fitcoach、foodcoach、buddha、brainstorm、coding、thinking、imagefenxi）；vestcoach 的 AGENTS.md 补充 sessions_send/sessions_spawn 参数说明（与 main 一致，避免只传 agentId 报错）。改后需 `openclaw gateway restart` 使 config 生效。
- **tomorrow_plan 格式统一（番茄钟兼容）**：规划教练写入的计划文件名统一为 `YYYY-MM-DD.md`（禁止「明日日期.md」等）；文件内容**必须**包含「时间|任务」的 Markdown 表格，供 personalOS 番茄钟解析。life-schedule-coach Skill 新增「计划文件内容格式（番茄钟兼容）」；cron 消息改为显式 YYYY-MM-DD 与表格要求。当日 `personalOS/data/tomorrow_plan/2026-02-27.md` 已补表格修复，番茄钟可正常读取。
- **data/rules 纳入规划流程**：`personalOS/data/rules/`（如 `morning_order.json`）此前由 main 写入，但规划教练（lifecoach）从未读取，导致规则未生效。Skill 已增加「一、4 用户/系统规则」与 2.1/2.2 中的「读用户规则」步骤；生成明日/今日计划前若存在该目录下规则文件则读取并遵守（如早晨顺序：定课→自修→早饭→正念→出门）。

## 2026-02-26
- **新增 agent 投资教练（vestcoach）**：`.openclaw/config` 增加 agents.list 条目、channels.feishu.groups（oc_f08d41bfb84e07670be80e0c8f488558）、bindings；main 与各 agent 的 allowAgents、tools.agentToAgent.allow 加入 vestcoach。新建 workspace-vestcoach（SOUL.md、AGENTS.md、MEMORY.md、.openclaw/workspace-state.json）。`.openclaw/state/.env` 增加 FEISHU_GROUP_ID_vestcoach。需执行 `openclaw gateway restart` 生效。

## 2026-02-25
- **Heartbeat 静默时段 + 60 分钟**：lifecoach、foodcoach 的 heartbeat 增加 `activeHours: 07:00～24:00 (Asia/Shanghai)`，00:00～07:00 不触发；间隔由 180m 改为 **60m**（有静默时段后更频繁检查可接受）。改后需 `openclaw gateway restart`。
- **Heartbeat 群里只发一句**：lifecoach heartbeat 改为 `target: "none"`，框架不再投递助手回复；发群仅靠 message 工具向规划群（`oc_b0f512c3328263b70ff9772c8288099f`）发一条，群里只会收到那一句。HEARTBEAT.md 已写明发群方式与 chat id。改后需 `openclaw gateway restart` 生效。手动触发时若不想整段进群则不要加 `--deliver`。
- 将 `.openclaw/.env` 中更新的 `MINIMAX_API_KEY` 同步到 `~/Library/LaunchAgents/ai.openclaw.gateway.plist` 的 `EnvironmentVariables`；执行 launchctl unload/load 并 `openclaw gateway restart`，Gateway 已正常运行。
- 规划教练明日计划仍 21:00 触发：根因为 jobs.json 已改为 23:00 但改后未重启 Gateway，进程内仍为旧 schedule。**处理**：执行 `openclaw gateway restart` 后，cron 将按 23:00 触发；CLAUDE.md 增加「改 cron 后需重启 Gateway」易错点。
- **上游 v2026.2.24 发布**（GitHub releases）：含多项 heartbeat/cron 修复与 1 条 BREAKING（heartbeat 默认投递从 `last` 改为 `none`，且禁止向 DM 投递）。本仓库 lifecoach/foodcoach 已显式配置 `heartbeat.target/to` 为飞书群，兼容新版本。本地更新：`openclaw update --channel stable` 或 `npm install -g openclaw@latest`，更新后需 `openclaw gateway restart`。详见本仓库「OpenClaw v2026.2.24 更新摘要」说明（可让 Cursor 总结）。
- **已完成升级至 v2026.2.24**：执行 `openclaw update --channel stable`（2026.2.21-2 → 2026.2.24），备份 config 为 `.openclaw/config.bak.20260225`；Gateway 因 v2026.2.24 的 config 校验失败曾无法启动（`plugins.entries.feishu` / `qwen-portal-auth` / `plugins.slots.memory` 报 plugin not found），已从 `plugins.entries` 移除 `feishu` 与 `qwen-portal-auth` 条目后 `openclaw gateway install` 通过，RPC probe ok，建议观察 1～2 次 heartbeat 是否正常发群。
- **Cron 优化**：当前共 **39 条** cron（原 49 条）。已删除 10 条已禁用测试任务（目标私信或缺失 delivery，且 v2026.2.24 已禁止向 DM 投递）；规划教练「每日 23 点明日计划」超时由 120s 调整为 180s。v2026.2.24 对 cron 的改进：announce 不再继承 lastThreadId、channel 不可用时短暂重试、ANNOUNCE_SKIP 等，业务任务均为飞书群投递（channel: feishu, to: oc_xxx），可受益。列表：`./scripts/oc cron list`。

## 2026-02-24
- 修复 fallback 未按 config 执行、始终走到 anthropic/claude-opus-4-6：根因为未设 `agents.defaults.model.primary`，OpenClaw 文档约定 omit 时假定 anthropic。已设 `agents.defaults.model.primary: "minimax/MiniMax-M2.5"`、`fallbacks: ["zai/glm-5", "deepseek/deepseek-chat"]`，并将 `agents.defaults.models` 限定为仅 minimax、zai/glm-5、deepseek（作为 allowlist），避免框架注入 anthropic。需 `openclaw gateway restart` 生效。
- 主模型已改为 minimax（各 agent primary 为 minimax，fallbacks 为 zai/glm-5、deepseek），以缓解智谱 429；Gateway 已重启。

## 2026-02-22
- 确认 OpenClaw 版本为 `2026.2.21-2`（检查时为 stable 最新）。
- 确认多 agent 的飞书分群路由处于可用状态。
- 修复 MiniMax 环境变量拼写：`minmax_API_KEY` -> `MINIMAX_API_KEY`。
- 配置 fallback 链路：`glm -> minimax -> deepseek`。
- 将 `fitcoach` 模型改为 `minimax/MiniMax-M2.5`。
- 增加 MiniMax provider 配置（国内端点 `api.minimaxi.com/anthropic`）。
- 将 `MINIMAX_API_KEY` 同步到 gateway 实际读取的运行环境文件。
- 重启 gateway，并确认 `minimax/MiniMax-M2.5` 出现在模型列表。
- 排查超时问题：定位到自动注入上下文过重 + 并发突发。
- 将 MemOS 调整为轻量参数：
  - `includeAssistant=false`
  - `memoryLimitNumber=3`
  - `preferenceLimitNumber=1`
  - `recallGlobal=true`（保留）
- 用户关闭 Cursor 侧 memos，以降低额外上下文注入。

## 2026-02-23
- 为 OpenClaw 注册 Moltbook Agent：先 `openclaw-imagefenxi`（认领链接报 Invalid claim token）；改用 `openclaw-imagefenxi-2` 重新注册，新 API Key 与认领链接已更新到 `.openclaw/.env` 与说明，待用户完成认领与推文验证。
- 修复 Gateway 配置无法加载导致规划教练等无响应：LaunchAgent plist 未带 `MINIMAX_API_KEY` / `DEEPSEEK_API_KEY`，config 解析报错。
- 用项目 state/config 重新执行 `openclaw gateway install --force`，并在 plist 的 `EnvironmentVariables` 中补入上述两个 key。
- 重启 Gateway，确认 status 无 MissingEnvVarError，Config (service) 有效，RPC 正常。
- 修复规划教练（及所有教练）「今天星期几/日期错一天」：根因为 LaunchAgent 进程未设 TZ，Node 按 UTC 解析，MemOS 注入的 Current Time 为 UTC 日期（如北京周一早上被写成周日 23:xx）。
- 在 LaunchAgent plist 中增加 `TZ=Asia/Shanghai`；MemOS 插件用 `formatTimeInTimezone(now, "Asia/Shanghai")` 显式按北京时间格式化「Current Time」，两处均已同步到 `.plugins` 与 `.openclaw/state/extensions`。
- 重启 Gateway 使 TZ 与插件生效。
- 规划教练「每晚 21:00 生成明日动态计划」：cron 每天 21:00（上海时区）触发 lifecoach，读取 personalOS/data/daily_summary/今日.json（JSON）与 30day.md，生成明日时间表并回复到规划群、写入 personalOS/data/tomorrow_plan/明日.md；SOUL.md 增加该流程说明，jobs.json 新增 job id lifecoach-daily-tomorrow-plan。
- 今日执行日志改为 personalOS/data/daily_summary/YYYY-MM-DD.json（JSON 格式，含 metrics、tasks），SOUL 与 cron 消息已同步。
- 规划教练计划落盘兜底：新增 `scripts/lifecoach-plan-fallback.js`，从 lifecoach 规划群 session 取最后一条「像计划」的 assistant 回复写入 `personalOS/data/tomorrow_plan/YYYY-MM-DD.md`；launchd 每天 21:05 执行 `--tomorrow`，避免模型漏写；可手动跑 `--today` 或 `--date YYYY-MM-DD`。plist 已安装到 `~/Library/LaunchAgents/ai.openclaw.lifecoach-plan-fallback.plist`。
- Heartbeat 改为仅 lifecoach 开启、间隔 60 分钟：`.openclaw/config` 中 `agents.defaults` 不设 heartbeat，仅在 lifecoach 的 `agents.list[]` 项下配置 `heartbeat: { every: "60m" }`；重启 Gateway 生效。
- lifecoach heartbeat 流程优化：每 60 分钟读取当日 `daily_summary/YYYY-MM-DD.json` 与当日 `tomorrow_plan/YYYY-MM-DD.md`，对比计划与执行偏离度，有需要时在本群主动发简短提醒/建议，否则 HEARTBEAT_OK；SOUL.md 与 HEARTBEAT.md 已补充该流程。
- lifecoach heartbeat 特别关注 `daily_summary` 中的 `skip_reason`：若存在则识别原因与情绪变化，必须主动发群消息探寻用户原因、问是否需一起调整，不回复 HEARTBEAT_OK。
- Heartbeat 投递兜底：`scripts/lifecoach-heartbeat-send-to-feishu.js` 改为基于 **heartbeat_logs**：每 10 分钟检查当日 `personalOS/data/heartbeat_logs/YYYY-MM-DD.md` 是否有新段落（按 `##` 拆分），若有则把最新段落以规划教练口吻发到规划群（send_im_message.py）；launchd 每 10 分钟跑一次，安装：`cp scripts/ai.openclaw.lifecoach-heartbeat-send.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/ai.openclaw.lifecoach-heartbeat-send.plist`。

## 2026-02-24
- 修复 heartbeat 投递兜底（10 分钟轮询）一直未执行：LaunchAgent 使用 `/usr/bin/env node`，launchd 环境无 node 导致每次退出 127（`env: node: No such file or directory`）。plist 改为使用 node 绝对路径 `/opt/homebrew/bin/node` 并增加 `PATH` 环境变量；已重新安装并 load，手动跑脚本验证可发到规划群。
- **60 分钟 heartbeat 未每小时都有日志的原因**：① Gateway 每 60 分钟会触发 heartbeat（gateway.log 有 `[heartbeat] started`），但 gateway.err.log 多次报 `[heartbeat] failed: Feishu account "default" not configured`，因投递到 Feishu 时 Gateway 查找的是 account id `default`，而 config 里只有 `main`。② 即使 heartbeat 消息已注入会话（如 09:34、10:34），模型调用（zai/glm-5）有时报 `Connection error`，无回复则不会写 heartbeat_logs。③ HEARTBEAT.md 里「日志输出」为可选，模型回复 HEARTBEAT_OK 时不一定追加段落。**修复**：在 `.openclaw/config` 的 `channels.feishu.accounts` 下增加与 `main` 同配置的 `default` 账户，使 Gateway 能解析投递目标。需重启 Gateway 后观察是否仍报 Feishu account default。
- 部署 **Healthchecks** 用于本地 cron 监控：在项目下新增 `healthchecks/`，使用 Docker Compose（PostgreSQL 16 + healthchecks/healthchecks:latest），端口 8000；已生成 .env（含 SECRET_KEY、DB 等），容器已启动；需本地执行 `docker compose run --rm web ... createsuperuser` 创建管理员后登录 http://localhost:8000。详见 `healthchecks/README.md`。
- **lifecoach-heartbeat-send 告警根因与修复**：launchd 下 PATH 仅有系统路径，`python3` 为系统 Python 无 `dotenv`，导致 `send_im_message.py` 报 `ModuleNotFoundError`，脚本 catch 后发 `/fail` 到 Healthchecks，故一直红铃铛。两脚本改为优先使用 `SEND_IM_SCRIPT_DIR/.venv/bin/python`（Jasonmemory 项目 venv），在 launchd 环境下也能正常发群并 ping 成功。
- **两个 10 分钟发群脚本接入 Healthchecks**：`lifecoach-heartbeat-send-to-feishu.js` 与 `foodcoach-heartbeat-send-to-feishu.js` 内增加 ping（读 `HEALTHCHECKS_PING_LIFECOACH_SEND` / `HEALTHCHECKS_PING_FOODCOACH_SEND`）；两枚 plist 已加占位环境变量。用户在 Healthchecks 建两个 Check（Period 10m、Grace 5m），把 Ping URL 填进 `~/Library/LaunchAgents/` 对应 plist 并 `launchctl unload/load` 即生效。详见 `healthchecks/README.md`「OpenClaw 两个 10 分钟发群脚本」。
- **lifecoach heartbeat 日志按时间顺序**：HEARTBEAT.md 第 4 步改为必写，并明确必须**追加到文件末尾**（先 read 全文，在末尾追加新段落后再 write 回），不要插入中间，保证 `## HH:MM 检查` 按时间顺序，10 分钟脚本才能正确取最新一段。
- **lifecoach 主动发群话术像真人教练**：HEARTBEAT.md 与 SOUL Heartbeat 段补充：发群那句必须像真人教练（简短、具体、有温度、可执行），禁止「主动提醒用户关注xxx」「建议补时段」等标签式话术；要写出真正会对用户说的那一句话；有惊喜感（执行好时真心肯定，有偏离时支持性一问或可落地建议）。日志里的「结论」可写 HEARTBEAT_OK 或实际发的那句话的简短摘要。
- **foodcoach 同步上述两处**：HEARTBEAT.md 要求日志**追加到文件末尾**（先 read 再末尾追加再 write），保证 HEARTBEAT_LOG 按时间顺序；发群话术补充「像真人教练、人话、禁止标签式、惊喜感」，SOUL Heartbeat 段同步。
- 为 **foodcoach** 开启 heartbeat（60 分钟）：config 中 foodcoach 增加 `heartbeat: { every: "60m", target: "feishu", to: "oc_d58072ebeb9a73604d17118e5f9bf01b" }`；workspace-foodcoach 的 HEARTBEAT.md 改为「智能教练」清单（读 30day、MEMORY、近期 memory，结合 30 天减重目标与节奏做轻量判断，在合适时主动给调整建议或惊喜式肯定+小 tip，否则 HEARTBEAT_OK）；SOUL.md 增加 Heartbeat 小节说明。需重启 Gateway 生效。
- foodcoach 增加 **HEARTBEAT_LOG**：workspace-foodcoach/HEARTBEAT_LOG/ 用于记录每次 heartbeat 执行（按日 YYYY-MM-DD.md，上海时区）；HEARTBEAT.md 中「执行日志」改为必写。HEARTBEAT_LOG/README.md 说明目录用途并给出**手动执行 heartbeat** 的方法（在饮食减重群发送默认 prompt + Current time）。
- foodcoach HEARTBEAT 写入与手动触发修正：① HEARTBEAT.md 执行日志改为**先写 HEARTBEAT_LOG 再回复/发群**、路径明确为绝对路径。② 饮食减重群为 requireMention，脚本发送的触发消息不会触发 agent；HEARTBEAT_LOG/README 已改为要求**先 @ 机器人**再发 prompt。冒烟测试需用户在群内 @ 机器人后发送 prompt，确认 HEARTBEAT_LOG/YYYY-MM-DD.md 有新增条目。
- foodcoach HEARTBEAT.md 被机器人判为「文件内容为空」：用户在群内 @ 机器人并发 heartbeat prompt 后，机器人回复「我已读取 HEARTBEAT.md，文件内容为空（仅包含注释）」。在 HEARTBEAT.md 最顶部增加一行非注释的强制说明「必须执行本清单，不可跳过。以下为 foodcoach 智能饮食教练 heartbeat 任务。」，避免被框架或模型误判为仅注释/空。若仍回复为空，需排查该会话注入的 workspace 上下文是否包含 foodcoach 的 HEARTBEAT.md 全文。
- **新增 agent 布达老师（budateacher）**：`.openclaw/config` 增加 agents.list 条目、channels.feishu.groups（oc_ccc3b0ba7eda5dea4f796f203aa72d01）、bindings；main 与 imagefenxi 的 allowAgents、tools.agentToAgent.allow 加入 budateacher。新建 workspace-budateacher（SOUL.md、AGENTS.md、MEMORY.md、.openclaw/workspace-state.json）。`.openclaw/state/.env` 增加 FEISHU_GROUP_ID_budateacher。需执行 `openclaw gateway restart` 生效。
- **拼写与人设修正**：budateacher 更正为 **Buddha（佛法老师）**，agent id 改为 `buddha`；workspace 重命名为 `workspace-buddha`；.env / state/.env 变量改为 `FEISHU_GROUP_ID_buddha`。SOUL 与 AGENTS 更新为人设「团队中最有智慧」、佛法/心性/因果视角的智慧担当。需 `openclaw gateway restart` 生效。
- **冒烟通过**：foodcoach 手动 heartbeat（@ 机器人 + prompt）已成功写入 HEARTBEAT_LOG/2026-02-24.md（示例：12:38 检查，锚定/近期反馈/判断/结论 HEARTBEAT_OK），链路打通。
- foodcoach heartbeat 日志发群兜底：新增 `scripts/foodcoach-heartbeat-send-to-feishu.js`，每 10 分钟检查当日 `workspace-foodcoach/HEARTBEAT_LOG/YYYY-MM-DD.md` 是否有新段落（按 `##` 拆分），若有则把最新段落发到饮食减重群（send_im_message.py）；plist `ai.openclaw.foodcoach-heartbeat-send`，安装：`cp scripts/ai.openclaw.foodcoach-heartbeat-send.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/ai.openclaw.foodcoach-heartbeat-send.plist`。HEARTBEAT_LOG/README 已补充说明。
- foodcoach 10 分钟脚本仅在有「需要推送」结论时发群：若段落结论为 HEARTBEAT_OK，脚本不再发到群（避免噪音）；仅当结论为已发群/需主动说时，才把该段发到群作兜底。
- **规划教练 10 分钟兜底未发群**：lifecoach-heartbeat-send 取的是「文件中最后一个 ## 段落」，而 personalOS heartbeat_logs 里段落顺序非按时间排列（最后一段是 06:28），导致脚本一直认为已发送。改为按 **## HH:MM** 解析时间，取**时间最新**的一段再判断是否已发；plist 增加 `HOME=/Users/zhangshuo` 保证 personalOS 路径正确。手动跑脚本验证已成功发送 12:44 段到规划群；plist 已重新安装并 load。
- **lifecoach workspace 重构（SOUL/AGENTS/Skill 分工）**：SOUL 收敛为人设与边界，步骤与路径全部移至 `skills/life-schedule-coach/SKILL.md`；AGENTS 明确「cron 请生成明日动态计划」「用户要求更新 tomorrow_plan」时先读 Skill；Skill 新增「二、计划生成与落盘」（2.1 每晚 23:00、2.2 今日计划、2.3 用户修改后写回），统一绝对路径与「只有 write 成功才可说已更新」。冒烟测试脚本 `scripts/smoke-test-lifecoach-workspace.js` 已加入，25 项检查通过。
- **规划教练生成明日计划改为 23:00**：cron 从 21:00 改为 23:00（`jobs.json` expr `0 23 * * *`），兜底脚本 plist 从 21:05 改为 23:05；SOUL/AGENTS/Skill/NOW/冒烟测试已同步。
- **新增 CLAUDE.md（易错点与纠正）**：根目录增加 `CLAUDE.md`，记录本仓库编辑时易犯错误与正确做法，修 bug/纠正后在此追加；`.cursor/rules/changelog-decisions-now.mdc` 将更新范围扩展为四份文档（CHANGELOG/DECISIONS/NOW/CLAUDE），示例场景补充「纠正后更新 CLAUDE.md」；NOW 快速恢复清单增加「同样错误又犯时看 CLAUDE.md」。

## 2026-02-28

- **新增 party agent（蜂群主持人）**：参考 BMAD party mode，在 OpenClaw 中新建第 11 个 agent——`party`，绑定飞书「蜂群Star」群（`oc_39807c4db0d05986700e8a76a9aef578`）。workspace-party 含 SOUL.md、AGENTS.md、REPLY_TO_GROUP.md、BOOTSTRAP.md、IDENTITY.md、USER.md；config 更新 agents.list、bindings、channels.feishu.groups、tools.agentToAgent.allow；所有 10 个现有 agent 的 allowAgents 与 AGENTS.md 通讯录均加入 `party`；新建共享文件目录 `.openclaw/party-room/`。Gateway 重启后 Runtime: running 确认生效。
- party agent 工作方式：默认模式下在一次回复内模拟 3-5 个 agent 视角（基于各 agent SOUL 摘要），主持人综合；`/深挖` 模式触发真实 sessions_spawn 蜂群，各 agent 写到 party-room 共享文件后汇总。
- **修复本地记忆机制（MEMORY.md 解禁 + MemOS 扩容 + 三教练触发条件 + Party 深挖记忆注入）**：① MemOS 插件注入的第 4 条 Attention 从「禁止读写 MEMORY.md」改为「鼓励写 MEMORY.md 作为本地长期记忆」（installed 与 source 两个副本同步修改）。② config 中 MemOS 参数调整：`includeAssistant` true、`memoryLimitNumber` 8、`preferenceLimitNumber` 3。③ lifecoach/fitcoach/foodcoach 三教练 SOUL.md 的「记忆沉淀」后追加触发条件（偏好确认/行为模式/目标数值/例外规则任一即写）、写入工具（write + 绝对路径）、不触发条件。④ Party SOUL.md 深挖模式增加步骤 2.5：spawn 前读取各 agent MEMORY.md 摘要，附加到任务描述中，使子 agent 带着历史记忆讨论。⑤ Gateway 重启（launchctl unload/load）后 RPC probe ok，冒烟测试通过。

## 2026-03-02

- **升级 OpenClaw 2026.2.26 → 2026.3.1**：执行 `openclaw update`，耗时约 6 分钟；升级前预检 cron 配置，发现 vestcoach 早盘（08:30）和收盘复盘（16:30）两个 cron 任务的 `delivery.mode: "none"`，与 v2026.3.1「delivery.mode=none 时禁用 message 工具」的 breaking change 冲突——若不处理，升级后投资群收不到消息。
- **修复 vestcoach cron 发群**：将两个 cron 任务的 delivery 改为 `{ mode: "announce", channel: "feishu", to: "oc_f08d41bfb84e07670be80e0c8f488558" }`；同步更新 vestcoach HEARTBEAT.md：cron 场景（第 2.4 节、3.3 节）改为「直接输出，框架 announce 模式投递，不调用 message 工具」，避免框架 + message 工具双发；heartbeat 场景（第 4.2 节）保留 message 工具。
- **修复 Gateway 启动失败（v2026.3.1 新增 gateway.mode 必填）**：升级后 Gateway 报 `Gateway start blocked: set gateway.mode=local (current: unset)`，原因是 plist 使用 `~/.openclaw/config`，该 config 的 `gateway` 块缺少 `"mode": "local"`。在 `~/.openclaw/config` 的 `gateway` 下补 `"mode": "local"`，重启后 `RPC probe: ok`，端口 18789 正常监听。
- **修复 main agent 报 "No API key for anthropic"**：根本原因有两处：① `~/.openclaw/config`（用户级 config）缺少 `agents.defaults.model` 配置，框架默认 anthropic；② plist `EnvironmentVariables` 未包含 MINIMAX_API_KEY / QWEN_API_KEY / DEEPSEEK_API_KEY 等 API key，模型无法调用。修复：在 `~/.openclaw/config` 的 `agents.defaults` 下补 `model.primary: "minimax/MiniMax-M2.5"` 及 fallbacks（qwen/deepseek）；在 plist 中补全所有 API key（MINIMAX/QWEN/DEEPSEEK/ZAI/MEMOS/TAVILY/FEISHU）及 `TZ=Asia/Shanghai`；launchctl unload/load 重启后 Gateway 正常运行。
- **统一 dashboard token，避免双机书签串线**：发现 `openclaw dashboard --no-open` 默认读取用户级 `~/.openclaw/config`，而 Gateway 进程可由 plist 指向项目级 `.openclaw/config`；两者 token 不一致会造成「URL 带的 token」与「Gateway 实际 token」错位，表现为 token mismatch/401。修复：将 `~/.openclaw/config` 的 `gateway.auth.token` 对齐为 `2b1bd02076235034ecee368b33772b5103a1cfdc4092e801`，并验证带/不带项目 env 执行 `openclaw dashboard --no-open` 都返回同一 token。

## 2026-03-07

- **绑定 Codex CLI OAuth 到 OpenClaw**：由于 OpenClaw 当前版本未内置 `openai-codex` 的 CLI 登录插件支持，通过 `codex login` 获得的 OAuth Token 无法直接通过 `openclaw models auth login` 导入。编写 JS 脚本直接读取 `~/.codex/auth.json` 中的 access token 和 refresh token，并手动写入 `.openclaw/state/agents/main/agent/auth-profiles.json` 中。
- **修复 openai-codex 报 401 invalid access token**：注入 OAuth credential 时需注意属性名为 `access` 和 `refresh`（而非 `accessToken`），否则 `@mariozechner/pi-ai` 获取不到 key 导致 HTTP 401。修复字段名后重启 docker container 验证通过。

## 2026-03-08

- **为 coding agent 建立独立开发沙盒**：创建 `bot/dev` 分支与 `git worktree` 目录 `/Users/zhangshuo/openclawxitong-bot`，用于让 coding agent 在独立副本中改代码，不直接污染主目录。
- **Docker 挂载 bot worktree**：`docker-compose.yml` 新增 `/Users/zhangshuo/openclawxitong-bot:/app-bot`，并重建 `openclaw-gateway` 容器，使容器内可见 `/app-bot`。
- **新接入技术大神群到 coding agent**：`.openclaw/config` 中新增群 `oc_093043b3a1ced90241f711b33019a373`（`requireMention: false`）及 `accountId=main/default` 两条 bindings；同时把 `coding` 的 workspace 改为 `/app-bot/.openclaw/workspace-coding`。
- **在 bot/dev 中补齐 workspace-coding**：由于 `workspace-coding` 不在 git 已跟踪内容里，新 worktree 初始不存在该目录；已在 `bot/dev` 下创建最小完整工作区（`AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md`、`HEARTBEAT.md`、`BOOTSTRAP.md`）。
- **coding agent 沙盒指令已收紧**：`bot/dev` 的 `workspace-coding/SOUL.md` 新增 message 工具发群约定、`/app-bot` 工作目录约定、`bot/dev` 分支与 git 安全规范；`TOOLS.md` 明确开放 `exec` 但仅允许在 `/app-bot` 下执行，禁止破坏性 git 命令。
- **本地冒烟通过**：`docker compose config` 与 `.openclaw/config` JSON 校验通过；容器重建后 `/app-bot/.openclaw/workspace-coding` 存在；容器内执行 `openclaw agent --agent coding` 的 `systemPromptReport.workspaceDir` 已显示 `/app-bot/.openclaw/workspace-coding`。飞书群真实收发仍待用户在“技术大神”群发一条消息做最终验收。
