# 决策记录（DECISIONS）

用途：记录关键决策、原因与影响，防止“只记得结果不记得为什么”。

## 2026-03-04 - Feishu 最终稳定方案：main 单连接 + 私信 open
- 决策：Docker 实例采用 `main` 单连接（`main.enabled=true`、`default.enabled=false`），并将 `dmPolicy` 设为 `open`、`allowFrom` 设为 `["*"]`；正式群沿用既有绑定，规划群关闭强制 @。
- 原因：实践验证显示 `default` 单连接下群可用但私信入站丢失；切回 `main` 单连接后私信恢复。保留双连接会出现账号切换与 `reconnect` 抖动。
- 影响：当前优先保证“群 + 私信”都稳定可用；后续若恢复双连接，需先完成连续稳定性验证。

## 2026-03-04 - 双机同步策略：自动 pull（安全）+ 手动 push
- 决策：在仓库内启用 launchd 定时任务，每 10 分钟执行 `scripts/git-auto-pull-safe.sh`；仅在工作区干净且分支有 upstream 时自动 `pull --rebase`。push 继续手动执行，不做自动化。
- 原因：你在工作机与家里机切换使用，最常见风险是忘记先拉取；但自动 push 容易把临时改动/冲突状态扩散到另一台机器。
- 影响：两台电脑可复制同一脚本与 plist 获得一致行为；dirty/ahead/diverged 时脚本会跳过并写日志，避免破坏本地现场；配套 `scripts/git-sync-status.sh` 可在开工前一条命令检查同步状态。

## 2026-03-04 - Docker 灰度实例 Feishu 连接单账号化（仅 default）
- 决策：Docker 灰度实例中禁用 `channels.feishu.accounts.main`，只保留 `default` 账号建立 WebSocket 连接；`bindings` 仍保留 `main/default` 双路由以兼容后续恢复。
- 原因：同一 Feishu App 双连接（main/default）会出现入站账号来回切换与 `reconnect` 抖动，用户体感为“有时回复有时不回复”。
- 影响：当前灰度链路稳定性提升；若后续需要恢复双连接，需先验证不会再出现账号切换抖动，再放开 `main.enabled`。

## 2026-03-04 - Feishu 提及策略改为“全局收紧 + 按群显式放开”
- 决策：`channels.feishu.requireMention` 维持 `true`，仅对确需免 @ 的群（含 Docker 测试群 `oc_5e2c2436f0a15c2927273d84350b2eb7`）显式设置 `requireMention: false`。
- 原因：排障期间曾用全局放开做临时兜底，但该方式影响面过大；同时 `{}` 在不同版本/配置合并语义下存在歧义，不适合作为长期约定。
- 影响：提及策略更可控，新增免 @ 群时必须写显式 `requireMention: false`，避免后续升级后行为漂移。

## 2026-03-04 - Feishu 群路由按 accountId 双轨配置（main + default）
- 决策：所有按群绑定的 workspace 路由统一同时配置 `accountId=main` 与 `accountId=default`，并补 `main <- feishu accountId=default` 兜底。
- 原因：线上日志显示同一机器人消息有时以 `feishu[default]` 入站；若 bindings 仅有 `accountId=main`，群消息会出现“收到但不派发到目标 workspace”。
- 影响：多 workspace 群路由对账号上下文切换更稳；后续新增群绑定时需同步新增 main/default 两条，避免再次出现“只有私信可回复”。

## 2026-03-04 - personalOS 运行数据并入 openclawxitong 单仓目录
- 决策：将原 `~/personalOS` 的运行关键数据（`daily_summary`、`plan_overrides`、`task_events.jsonl`、`30day.md`）迁移到 `.openclaw/workspace-lifecoach/data/personalos/`，并让教练链路优先读取该仓库内路径。
- 原因：跨项目绝对路径 + `exec` 读取成本高，且迁移到工作机与 Docker 时维护成本高、稳定性差。
- 影响：后续只需维护一个仓库；`scripts/migrate-personalos-into-workspace.js` 可重复执行做增量同步；旧 `~/personalOS` 路径从主链路移除。

## 2026-03-04 - 工作机采用 Docker 并行隔离部署（先测试群）
- 决策：新实例通过 Docker 部署，使用独立端口（`18790`）与独立 state/config 挂载，先在测试群灰度验证后再切正式群。
- 原因：工作机已有在跑的 OpenClaw 实例，直接复用宿主环境容易冲突（端口、群路由、双发风险）。
- 影响：仓库新增 `Dockerfile`、`docker-compose.yml`、`docker/entrypoint.sh`、`.env.docker.example` 与部署文档；上线流程改为“测试群验证 -> 正式群切换 -> 旧实例解绑”。

## 2026-03-04 - 反思群关闭 requireMention，保证纪要/普通消息可触发人生导师
- 决策：将反思群 `oc_e5eb757efecfb1367305c64610eb5068` 的 `channels.feishu.groups` 设为 `{}`（不强制 @）。
- 原因：日志显示消息已进入该群但因 `did not mention bot` 未派发到 `thinking`，导致用户感知为“bot 不回复”。
- 影响：反思群内纪要机器人消息与用户普通消息都可直接触发人生导师会话；若后续噪声增加，再按需加精细过滤策略。

## 2026-03-03 - Cron `announce` 任务统一单通道投递（不再要求 message 工具二次发群）
- 决策：对使用 `delivery.mode: "announce"` 的 cron 任务，payload 指令统一为“直接输出，由框架 announce 投递”，不再在任务文案中要求“再调用 message 工具发群”。
- 原因：升级后发现这两种投递方式混用会增加双发、投递冲突、执行超时概率；同时给模型两个互斥动作，会放大不稳定性。
- 影响：已完成 `lifecoach-daily-tomorrow-plan`、`fitcoach-after-noon-exercise`、`fitcoach-after-sat-longrun` 以及全部 `food-int-*` 任务清理并通过手动 cron 冒烟；后续新增 cron 默认沿用该规则。

## 2026-03-03 - 会议纪要群接入 thinking 并关闭 requireMention
- 决策：将群 `oc_5d9a4e9670c5a94ca916484b52cd9f93` 绑定到 `thinking`（人生导师），并在 `channels.feishu.groups` 对该群关闭 `requireMention`。
- 原因：会议纪要机器人通常不会 `@` OpenClaw 机器人；若保留 `requireMention`，纪要消息无法自动触发人生导师链路。
- 影响：该群内纪要机器人新消息可直接进入 `thinking` 会话，人生导师后续可基于这些内容做跟进建议。

## 2026-03-03 - `plugins.entries` 只保留真实安装插件
- 决策：项目 config 的 `plugins.entries` 仅保留真实安装且需要注册的插件（当前为 `memos-cloud-openclaw-plugin`），移除 `feishu` 与 `qwen-portal-auth`。
- 原因：`feishu` 为内置通道能力，`qwen-portal-auth` 在当前环境非必需；升级后继续保留会提高 config 兼容风险。
- 影响：当前 `openclaw config validate --json` 通过，Gateway 可正常重载；后续升级时插件校验风险降低。

## 2026-03-03 - tomorrow_plan 统一迁移到 workspace-lifecoach 内部路径
- 决策：计划文件落盘与读取路径统一为 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`，不再使用 `personalOS/data/tomorrow_plan`。
- 原因：`write/edit` 工具对 workspace 外路径有沙箱限制，旧路径频繁触发 `Path escapes workspace root`，导致计划写入不稳定、cron 超时与后续读取失败。
- 影响：已同步更新 lifecoach/fitcoach 的 SOUL 与 Skill、lifecoach HEARTBEAT、`jobs.json` 三条相关 cron payload、`scripts/lifecoach-plan-fallback.js` 和冒烟脚本；历史计划文件已迁移到新目录。

## 2026-03-03 - personalOS 外部路径读取统一使用 exec
- 决策：凡读取 `/Users/zhangshuo/personalOS/...` 下的数据文件（如 `daily_summary`、`archive/docs/30day.md`、`data/rules/*`），统一采用 `exec + cat`，不再把 `read` 作为主路径。
- 原因：这些文件位于 workspace 外，运行时在不同 agent/workspace 上下文里稳定性不一致；统一用 exec 可避免沙箱边界导致的间歇性读取失败。
- 影响：lifecoach/fitcoach 的 Skill 与 HEARTBEAT、以及相关 cron payload 文案已同步为 exec 读取策略；workspace 内 `tomorrow_plan` 仍用 read/write。

## 2026-02-28 - 用 Qwen 3.5 Plus 替换 GLM-5 作为 fallback、plist 必须写 API key
- 决策：① 全局 fallback 链从 `minimax/MiniMax-M2.5 → zai/glm-5 → deepseek/deepseek-chat` 改为 `minimax/MiniMax-M2.5 → qwen/qwen3.5-plus → deepseek/deepseek-chat`。② Gateway plist 的 EnvironmentVariables 必须包含所有 API key（MINIMAX_API_KEY、QWEN_API_KEY、DEEPSEEK_API_KEY 等），不能只靠 .env。③ lifecoach Skill 中写 personalOS 文件改用 exec 而非 write/edit。
- 原因：① ZAI/GLM-5 账户余额为零（429），无法作为 fallback。② plist 中没有 API key，launchctl unload/load 后 Gateway 进程丢失所有 key，所有模型报 401。③ write/edit 工具有 workspace 沙箱限制，写 personalOS 路径报 "Path escapes workspace root"，软链接方案也被框架检测拒绝。
- 影响：config 中所有 `zai/glm-5` 已替换为 `qwen/qwen3.5-plus`；plist 已补齐 5 个环境变量；lifecoach Skill 已更新写入方式；agent 间通信恢复正常。

## 2026-02-28 - vestcoach 适应期（Day 1-3）不依赖持仓、今日一课必须从真实数据带出
- 决策：① vestcoach heartbeat 开场逻辑增加「先判阶段再选场景」：适应期 Day 1-3 有专用场景（认识市场/认识账户/看一只股票），不依赖账户持仓数据；仅 Day 4+ 才使用「首次买入后第一天」等持仓场景。② 今日一课禁止百科式概念解释，改为「带用户做一件事」（带读新闻/看个股/看指标/做思考），每次必须包含真实数据和一个给用户的小任务。③ 收盘复盘按阶段分为「观察式复盘」（适应期）和「实战式复盘」（有持仓后）。
- 原因：Day 1 用户实际体验反馈——① 测试账户有开发期遗留持仓导致 heartbeat 误判为「首次买入后第一天」场景，给用户说「你持仓腾讯」但用户从未买过。② 今日一课选了「什么是股票」，用户反馈太空洞、没营养，期望的是带看一篇真实财经新闻、学会怎么读新闻。③ 整体内容缺乏行动导向，与 brainstorming 里约定的「知识点从实盘带出」脱节。
- 影响：HEARTBEAT.md、SKILL.md、MEMORY.md 已同步更新；测试账户假持仓已清除；heartbeat_log 已重置为未执行，下次 heartbeat 将按新逻辑重新触发。

## 2026-02-26 - Fitcoach 按「计划完成时间点后」cron 反馈，不用 heartbeat
- 决策：fitcoach 的核心价值是在计划运动完成时间点之后（如 13:00 计划完成锻炼 → 13:30）及时给用户「目标是否在正轨」的反馈、完成建议、下一步调整；不使用 heartbeat，改为在对应时间点后的 cron 中读当日计划（tomorrow_plan/今天.md）、当日执行日志（daily_summary）、佳明新数据（若有），生成解读并发到运动群。规划教练每晚 23:00 生成明日计划后通知 fitcoach（sessions_spawn）；fitcoach 由 jobs.json 中预先配置的固定 cron（如 13:30 每日）在触发时读计划并判断是否有「刚过」的运动块再反馈。
- 原因：用户希望 fitcoach 在「该练完了」的时刻附近给反馈（完成/超时/延后/跳过都能及时解读），而不是固定间隔的 heartbeat；cron 按计划时间点跑更贴合理念。
- 影响：lifecoach 的 23:00 流程增加「通知 fitcoach」一步；fitcoach SOUL/Skill 明确「计划完成时间点后反馈」流程；需在 state/cron/jobs.json 中为 fitcoach 添加 cron（如 13:30 每日），payload 指明读今日计划并做反馈；fitcoach 保持 HEARTBEAT 为空。

## 2026-02-25 - Heartbeat 群里只发一句：改为 target: "none" + 仅用 message 工具发群
- 决策：lifecoach heartbeat 改为 `target: "none"`，不再让框架投递助手回复；需要发群时**仅用 message 工具**向规划群（`oc_b0f512c3328263b70ff9772c8288099f`）发一条消息。这样群里只会收到 message 工具的那一句，不会收到整段过程。
- 原因：OpenClaw 设计是「投递整段助手回复」，无「只投递 message 工具结果」配置；把 target 设为 `none` 后框架不投递回复，但 heartbeat 照常跑、message 工具照常可用，故仅 message 工具内容会进群。
- 影响：定时 heartbeat 触发的发群只会有 1 条（教练句）。手动测试时若用 `openclaw agent --deliver --reply-to oc_xxx` 仍会整段投递；若想只看到一句，手动触发时不要加 `--deliver`。

## 2026-02-25 - Heartbeat 整段投递到群：确认为 OpenClaw 底层设计，非配置可改
- 决策：接受「heartbeat / openclaw agent --deliver 时投递的是助手整段回复」这一事实；用 HEARTBEAT.md 文字约束（只输出 HEARTBEAT_OK 或 .）作为权宜缓解；长期可向 OpenClaw 提需求（如仅投递 message 工具结果或 ackMaxChars 内内容）。**后续已改为 target: "none" + 仅 message 工具发群，见上一条。**
- 原因：查阅 [OpenClaw Heartbeat](https://docs.openclaw.ai/gateway/heartbeat) 与 [Agent Send](https://docs.openclaw.ai/agent-send) 文档可知：heartbeat 投递的是「模型的回复」作为 final answer；`openclaw agent --deliver` 投递的也是「本次 agent 的回复」到 channel。框架**没有**「只投递 message 工具结果」或「只投递最后一行」的配置。唯一相关控制是 `ackMaxChars`（默认 300）：若回复以 HEARTBEAT_OK 开头/结尾且剩余内容 ≤ 300 字则整条不投递；但模型若输出长段分析，整段都会被当作要投递的回复。
- 影响：heartbeat 直接推送到群已验证可行；若要群里只看到「一句教练话」，要么依赖模型严格遵守「只输出 . 或 HEARTBEAT_OK」、要么等框架支持仅投递工具结果/短回复。

## 2026-02-25 - 升级至 v2026.2.24 后从 plugins.entries 移除 feishu / qwen-portal-auth
- 决策：升级到 OpenClaw v2026.2.24 后，从 `plugins.entries` 中删除 `feishu` 与 `qwen-portal-auth` 两个条目，仅保留 `memos-cloud-openclaw-plugin`。
- 原因：v2026.2.24 的 config 校验更严，将 `plugins.entries.feishu` / `qwen-portal-auth` 视为“需从插件注册表解析的插件”，解析不到则报 plugin not found 并导致 Gateway 启动失败；feishu 通道由 OpenClaw 内置提供，无需在 entries 中声明。
- 影响：飞书通道与 heartbeat 投递到飞书群仍按 `channels.feishu` 与 agent 的 `heartbeat.target/to` 工作；若后续官方要求 feishu 以插件形式显式启用，再按文档补回。

## 2026-02-24 - 显式设 agents.defaults.model.primary 并限定 models allowlist，避免 fallback 走到 anthropic
- 决策：在 config 中设置 `agents.defaults.model.primary: "minimax/MiniMax-M2.5"`，`agents.defaults.model.fallbacks: ["zai/glm-5", "deepseek/deepseek-chat"]`；`agents.defaults.models` 仅包含 `minimax/MiniMax-M2.5`、`zai/glm-5`、`deepseek/deepseek-chat`（作为模型目录与 allowlist）。
- 原因：OpenClaw 文档约定「若未指定 provider 则假定 anthropic」；此前只配了 defaults.model.fallbacks、未配 primary，导致解析默认主模型时被框架用内置 anthropic/claude-opus-4-6，fallback 链变成「我们配的 primary → anthropic」而非「primary → minimax/glm/deepseek」，且未配置 Anthropic API key 导致整轮失败。
- 影响：默认链与 allowlist 仅限我们已配 key 的三种模型；改 config 后需重启 Gateway 生效。

## 2026-02-22 - fitcoach 切换到 MiniMax M2.5
- 决策：将 `fitcoach` 模型设为 `minimax/MiniMax-M2.5`。
- 原因：降低 GLM 路径压力，并与预期的模型分工一致。
- 影响：`fitcoach` 的成本/能力画像变化；依赖 MiniMax key 与 provider 配置。

## 2026-02-22 - 固定 fallback 顺序 `glm -> minimax -> deepseek`
- 决策：GLM 为主，MiniMax 第一后备，DeepSeek 第二后备。
- 原因：尽量保持主模型体验，同时提升高峰期稳定性。
- 影响：退化场景可自动切换，而不是整轮失败。

## 2026-02-22 - MiniMax 使用国内端点
- 决策：MiniMax provider `baseUrl` 设为 `https://api.minimaxi.com/anthropic`。
- 原因：匹配当前账号/地区与 M2.5 接入路径。
- 影响：请求走国内端点；运行环境必须提供 `MINIMAX_API_KEY`。

## 2026-02-22 - 记忆策略改为轻量模式
- 决策：保留 `recallGlobal: true`，并设定 `memoryLimitNumber: 3`、`preferenceLimitNumber: 1`、`includeAssistant: false`。
- 原因：降低提示词膨胀和超时风险，同时保留一定跨群记忆感知。
- 影响：单轮召回体积更小，自动携带的历史噪声减少。

## 2026-02-22 - 暂停 Cursor 侧 memos
- 决策：当前工作流关闭 Cursor memos。
- 原因：避免双记忆链路叠加，减少提示词负担。
- 影响：Cursor 侧主要依赖当前会话上下文；后续可按需再启用。

## 2026-02-23 - Gateway LaunchAgent 必须携带 config 所需环境变量
- 决策：使用本项目 state/config 的 Gateway，其 LaunchAgent plist 的 `EnvironmentVariables` 中必须包含 config 里引用的全部变量（如 `MINIMAX_API_KEY`、`DEEPSEEK_API_KEY`）。
- 原因：`openclaw gateway install` 不会自动把 .env 中的 API key 写入 plist；进程启动时若缺少这些变量，config 解析会报 MissingEnvVarError，导致配置无效、飞书机器人无响应。
- 影响：修改 .env 后若涉及 config 引用的变量，需同步更新 plist 并 `openclaw gateway restart`，或重新在带 env 的环境下执行 `openclaw gateway install --force` 并手动补全 plist 中的 key。

## 2026-02-23 - Gateway 与 MemOS 必须使用用户时区（Asia/Shanghai）
- 决策：Gateway 进程环境设置 `TZ=Asia/Shanghai`；MemOS 插件在注入「Current Time」时用 `Intl.DateTimeFormat` 显式按 `Asia/Shanghai` 格式化，不依赖进程 TZ。
- 原因：LaunchAgent 启动的 Node 未设 TZ 时易用 UTC，导致「当前时间」被格式成 UTC 日期（如北京周一 7:43 变成 2026-02-22 23:43），模型误判为周日，规划教练等回复「今天是周日」等错误星期。
- 影响：plist 中需保留 TZ；插件源码与 state/extensions 副本需一致；若以后支持多时区用户，可改为插件配置项 `timeZone`。

## 2026-02-23 - 规划教练每晚 21:00 根据今日日志生成明日动态计划
- 决策：用 cron 每天 21:00（上海时区）触发规划教练（lifecoach），读取用户提供的「今日执行日志」（绝对路径），结合 30 天计划生成明日动态时间表，回复到规划群并写入指定目录。
- 原因：规划常有动态变化（放假、补班、未完成、异常），需要基于「今天实际发生了什么」生成「明天可执行的」弹性安排，而非固定模板。
- 影响：今日执行日志来自 `personalOS/data/daily_summary/YYYY-MM-DD.json`（JSON，含 metrics/tasks）；生成的明日计划在规划群 + `personalOS/data/tomorrow_plan/YYYY-MM-DD.md`；cron job 见 `.openclaw/state/cron/jobs.json` id `lifecoach-daily-tomorrow-plan`。

## 2026-02-23 - 规划教练计划落盘用脚本兜底
- 决策：增加独立脚本在「模型可能漏写」时兜底：从 lifecoach session 的最近 assistant 消息中取「像计划」的一条，写入 `tomorrow_plan/YYYY-MM-DD.md`；每天 23:05 用 launchd 跑一次（--tomorrow），覆盖 23:00 cron 触发后的明日计划（原为 21:05，与 cron 改为 23:00 同步）。
- 原因：提示词再多也有概率遗漏写入步骤；脚本读取 session 状态后落盘，不依赖模型记性，保证最终一定有文件。
- 影响：`scripts/lifecoach-plan-fallback.js`，launchd 标签 `ai.openclaw.lifecoach-plan-fallback`；若模型已写则文件被脚本再写一次（内容基本一致），可接受。

## 2026-02-25 - 规划教练明日计划改为每晚 23:00
- 决策：规划教练生成明日计划的 cron 由 21:00 改为 **23:00**（上海时区）；兜底脚本 plist 已为 23:05。
- 原因：用户希望延后到 23 点更新明日计划（`tomorrow_plan/明日.md`）。
- 影响：`.openclaw/state/cron/jobs.json` 中 `lifecoach-daily-tomorrow-plan` 的 `schedule.expr` 为 `"0 23 * * *"`；**修改 jobs.json 中 cron 时间后必须重启 Gateway 才会生效**（否则进程内仍为旧 schedule），见 CLAUDE.md「Cron 调度」。

## 2026-02-23 - 仅 lifecoach 开启 heartbeat（60 分钟）
- 决策：仅规划教练（lifecoach）开启定期 heartbeat，间隔 60 分钟；其它 agent 不跑 heartbeat。
- 原因：用户只需规划教练有定期心跳（如按 HEARTBEAT.md 做轻量检查），其它 agent 不需要。
- 影响：`.openclaw/config` 中 `agents.defaults` 不设 heartbeat；`agents.list[]` 中仅 lifecoach 有 `heartbeat: { every: "60m" }`。lifecoach 的 `workspace-lifecoach/HEARTBEAT.md` 需有实质内容才会执行（空或仅注释时 OpenClaw 会跳过以省 API）。

## 2026-02-23 - lifecoach heartbeat 读当日日志并对比计划偏离度后主动互动
- 决策：lifecoach 的 heartbeat（每 60 分钟）固定流程为：读当日 `daily_summary/YYYY-MM-DD.json` 与当日 `tomorrow_plan/YYYY-MM-DD.md`，对比执行与计划偏离度；若偏离大、卡点明显或临近当日结束有关键未完成，则在本群主动发一条简短提醒/建议，否则回复 HEARTBEAT_OK。
- 原因：用户希望规划教练能基于「当日实际执行情况」与「当日原计划」做对比，在需要时主动互动，而不是被动等用户来问。
- 影响：`workspace-lifecoach/HEARTBEAT.md` 与 SOUL.md 中已写明该流程；日期一律按上海时区「今天」；可选将结论追加到 `personalOS/data/heartbeat_logs/YYYY-MM-DD.md`。

## 2026-02-23 - heartbeat 对 daily_summary 的 skip_reason 必须主动互动
- 决策：lifecoach heartbeat 读取当日 `daily_summary` 时，若 JSON 中存在 **`skip_reason`**（用户记录的跳过原因），必须识别原因与情绪变化，并**主动发群消息**探寻用户原因、问是否需一起调整，不回复 HEARTBEAT_OK。
- 原因：skip_reason 反映用户主动记录的「为什么没做」，可能伴随情绪或卡点，需要教练主动关切、而非静默跳过。
- 影响：HEARTBEAT.md 与 SOUL.md 中已明确 skip_reason 为「必须主动互动」的触发条件。

## 2026-02-24 - Feishu 增加 account "default" 以修复 heartbeat 投递失败
- 决策：在 `channels.feishu.accounts` 下增加与 `main` 同配置的 `default` 账户（同一 appId/appSecret）。
- 原因：Gateway 在投递 lifecoach heartbeat 到 Feishu 时查找 account id `"default"`，config 仅配置了 `main`，导致 `[heartbeat] failed: Feishu account "default" not configured`，60 分钟 heartbeat 虽被触发但无法完成投递/会话注入或后续发群。
- 影响：修改后需重启 Gateway；若 OpenClaw 后续支持在 heartbeat 配置中指定 accountId，可再改为显式指定 `main` 并移除 default 别名。

## 2026-02-24 - foodcoach 开启 heartbeat，定位为智能教练而非定时提醒
- 决策：为 foodcoach 配置 `heartbeat: { every: "60m", target: "feishu", to: "oc_d58072ebeb9a73604d17118e5f9bf01b" }`，并编写「智能教练」向的 HEARTBEAT.md：读 30day、MEMORY、近期 memory，结合 30 天减重目标与节奏做轻量判断，在合适时主动给调整建议或惊喜式肯定+小 tip，否则 HEARTBEAT_OK；cron 的固定干预提醒保留。
- 原因：用户希望饮食教练有「惊喜感」、能真正帮助调整饮食、像智能教练而不是到点提醒的机器人；30 天减重目标与 MEMORY 中的行为模式（如专注-食欲循环）可作为主动触达依据。
- 影响：foodcoach 每 60 分钟会收到一次 heartbeat；需重启 Gateway 生效。与 lifecoach 类似，若 Gateway 报 Feishu account default 则依赖已配置的 `accounts.default`。

## 2026-02-24 - lifecoach heartbeat 日志必须按时间顺序（追加到文件末尾）
- 决策：lifecoach 每次 heartbeat 写日志时必须**追加到当日 heartbeat_logs 文件末尾**（先 read 全文，在末尾追加新段落后再 write 回），不得插入到文件中间；日志段落改为必写。
- 原因：此前模型可能用 edit 插入或写在不同位置，导致 `## HH:MM 检查` 乱序，10 分钟兜底脚本按「最新一段」取内容时可能取错；用户要求日志按时间顺序。
- 影响：HEARTBEAT.md 第 4 步明确「追加到文件末尾」且为必写；若模型未遵守，需在提示中进一步强化。

## 2026-02-24 - lifecoach 主动发群话术要像真人教练、有惊喜感
- 决策：lifecoach heartbeat 需要主动发群时，发的那一句必须**像真人教练**：简短、具体、有温度、可执行；禁止「主动提醒用户关注 xxx」「建议补时段」等汇报式、标签式话术；要写出真正会对用户说的那一句话；有**惊喜感**（执行好时真心肯定，有偏离时支持性一问或可落地建议）。
- 原因：用户反馈现有结论（如「主动提醒用户关注自修 missed，建议补时段」）没有价值、不像人，希望真正像人一样的教练给指导、主动沟通，并有惊喜。
- 影响：HEARTBEAT.md 与 SOUL Heartbeat 段已补充上述约定；日志里的「结论」可写 HEARTBEAT_OK 或实际发的那句话的简短摘要。**foodcoach 同步**：同一原则写入 workspace-foodcoach 的 HEARTBEAT.md 与 SOUL（发群人话+惊喜感，日志末尾追加）。

## 2026-02-24 - 修改/上线后先冒烟测试再更新 CHANGELOG/DECISIONS/NOW
- 决策：在 .cursor/rules/changelog-decisions-now.mdc 中增加「先冒烟再更新」：做完必要代码/配置修改后，必须先完成冒烟测试、确认链路打通，再更新 CHANGELOG-RUNNING / DECISIONS / NOW；未通过冒烟测试不得更新上述三份文件。
- 原因：避免未验证的改动被记入运行流水或决策，导致后续排查依据失真；用户要求开发完做冒烟测试、全部打通后再更新。
- 影响：Agent 在改配置/修 bug 后需先跑通冒烟（或明确标注需用户侧验证的步骤），通过后再写 CHANGELOG/DECISIONS/NOW。

## 2026-02-24 - 新增 CLAUDE.md 作为易错点与纠正文档
- 决策：在项目根目录增加 `CLAUDE.md`，专门记录「本仓库中 Claude/人编辑时容易犯的错误」与「纠正方式」；修完 bug 或做完纠正后在此追加一条；规则约定与 CHANGELOG/DECISIONS/NOW 一并更新。
- 原因：借鉴 Boris Cherny 的 CLAUDE.md 用法，通过一份文档持续压低重复错误率；DECISIONS 记「为什么这样决策」，CLAUDE 记「这样改会错、应该那样改」。
- 影响：Agent 与人在修 bug/纠正后需在 CLAUDE.md 末尾追加；NOW 快速恢复清单增加对 CLAUDE.md 的引用；规则中「三份文档」改为「四份文档」。

## 2026-02-28 - 解禁本地 MEMORY.md 写入 + MemOS 扩容 + 三教练记忆触发 + Party 深挖记忆注入

- 决策：① 修改 MemOS 插件注入指令，从禁止读写 `MEMORY.md` 改为鼓励 agent 把确认的事实写入本 workspace 的 `MEMORY.md`；② MemOS config 参数调整为 `includeAssistant: true`（教练回复也存入 MemOS Cloud）、`memoryLimitNumber: 8`、`preferenceLimitNumber: 3`；③ 三教练 SOUL 增加记忆触发条件与写入路径；④ Party 深挖模式 spawn 前读各 agent MEMORY.md 摘要注入任务。
- 原因：MemOS 插件的第 4 条 Attention 明确禁止读写本地 `MEMORY.md`，导致各 agent 的本地长期记忆从未被更新，蜂群协同缺乏历史上下文；MemOS Cloud 的 recall 数量（3 facts + 1 preference）太少，不足以支撑个性化教练场景。
- 影响：各 agent 开始在确认用户偏好/目标/行为模式时写入本地 MEMORY.md；MemOS Cloud 每轮 recall 返回 8 facts + 3 preferences；Party 深挖模式子 agent 能带着历史记忆参与讨论；需重启 Gateway 使 config 生效。

## 2026-02-28 - 新增 party agent 实现蜂群 Party Mode

- 决策：新增独立 `party` agent，绑定飞书「蜂群Star」群，实现 BMAD party mode 的蜂群讨论体验。
- 原因：用户想把 BMAD 的多角色讨论模式引入 OpenClaw；party agent 作为协调者，深度了解所有 agent 的风格与专业领域，在一次回复内模拟多声音发言 + 主持人综合，比 BMAD 还强的是可以用 `/深挖` 触发真实 sessions_spawn 召集各 agent 的真实知识库。
- 影响：新增第 11 个 agent（party），所有现有 agent 的 allowAgents 均加入 party，形成全互通网络；party-room/ 目录作为深挖模式的共享文件协调空间。默认模式（快速）无额外延迟，深挖模式利用真实 agent 带入各自历史记忆。

## 2026-02-24 - Healthchecks 自动创建 Check 用 Django shell 并写入文档
- 决策：为 OpenClaw 等任务自动创建 Healthchecks Check 时，用 **Django shell**（`docker compose exec web ... manage.py shell -c "..."`）在容器内创建 `Check`、取 `code` 拼出 ping URL，再写进 repo 的 plist 并同步到 `~/Library/LaunchAgents/`；完整流程记录在 `healthchecks/README.md` 的「后续可复用：用 Django 直接创建 Check 并写入 plist」。
- 原因：自建实例下不需要用户去后台拿 API Key；Agent 或脚本可直接在容器内创建 Check 并拿到 URL，便于后续新增监控任务时复用同一套做法。
- 影响：新增需监控的定时任务时，按 README 中 1→2→3 步执行即可；README 含示例 Python 片段与 launchctl 命令。
