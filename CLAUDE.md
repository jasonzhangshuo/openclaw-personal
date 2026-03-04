# CLAUDE.md（易错点与纠正）

用途：记录本仓库中 Claude/人编辑时**容易犯的错误**与**纠正方式**，避免重复踩坑。每次修完 bug 或做完一次「纠正」后，在此追加一条，便于后续会话与协作者不重复犯同样错误。

---

## 约定

- **何时更新**：修完 bug、纠正一次错误行为、或发现「这样写/这样改会出事」后，在本文件末尾追加一条（日期 + 现象 + 原因 + 正确做法）。
- **写什么**：现象（错了会怎样）、根因（为什么错）、正确做法（do / don't）。保持短句、可执行。
- **与 DECISIONS 的区别**：DECISIONS 记「我们为什么这样决策」；本文件记「这样改会错，应该那样改」。

---

## 易错点与纠正

### Gateway / LaunchAgent

- **现象**：Gateway 无响应、config 解析报 MissingEnvVarError，飞书机器人不工作。  
  **原因**：LaunchAgent plist 的 `EnvironmentVariables` 未包含 config 里引用的变量（如 `MINIMAX_API_KEY`、`DEEPSEEK_API_KEY`）。`openclaw gateway install` 不会自动从 .env 写入 plist。  
  **正确做法**：修改 .env 或 config 引用后，同步更新 `~/Library/LaunchAgents` 里对应 plist 的 `EnvironmentVariables`，或带齐 env 重新执行 `openclaw gateway install --force` 并手动补全 plist。改完 `launchctl unload` 再 `load` 并 `openclaw gateway restart`。

- **现象**：规划教练等回复「今天是周日」或日期/星期错一天。  
  **原因**：LaunchAgent 进程未设 TZ，Node 按 UTC 解析时间，MemOS 注入的「Current Time」变成 UTC。  
  **正确做法**：plist 的 `EnvironmentVariables` 中必须包含 `TZ=Asia/Shanghai`；MemOS 插件注入当前时间时用 `formatTimeInTimezone(..., "Asia/Shanghai")` 显式按上海时区格式化。

### Heartbeat / 教练

- **现象**：lifecoach 或 foodcoach 的 heartbeat 有内容但飞书群收不到；Gateway 报 `Feishu account "default" not configured`。  
  **原因**：Gateway 投递 heartbeat 时查找的 account id 为 `default`，config 里只配了 `main`。  
  **正确做法**：在 `channels.feishu.accounts` 下增加与 `main` 同配置的 `default` 账户，重启 Gateway。

- **现象**：heartbeat 日志乱序或 10 分钟兜底脚本取到错误的段落。  
  **原因**：写 HEARTBEAT_LOG / heartbeat_logs 时插入到文件中间或未按时间顺序。  
  **正确做法**：每次写日志必须**追加到当日文件末尾**（先 read 全文，在末尾追加新段落后再 write 回），不要用 edit 插入中间。HEARTBEAT.md 中明确「追加到文件末尾」且为必写。

- **现象**：主动发群的话术像汇报、标签式，用户觉得没价值。 
 **原因**：模型输出了「建议补时段」「主动提醒用户关注 xxx」等结论式句子，而非真人教练会说的那一句话。 
 **正确做法**：HEARTBEAT.md 与 SOUL 中约定：发群那句必须像真人教练（简短、具体、有温度、可执行），禁止标签式话术；要写出真正会对用户说的那一句话，有惊喜感（执行好时真心肯定，有偏离时支持性一问或可落地建议）。

- **现象**：heartbeat 发群后用户收到多条/整段过程（分析、步骤、「现在需要发群」等）。 
 **原因**：OpenClaw 设计是投递「助手整段回复」，无「只投递 message 工具结果」配置；模型即使用 message 工具只发一句，回复里的分析也会一起进群。 
 **正确做法**：该 agent 的 heartbeat 设为 **`target: "none"`**，框架不再投递助手回复；发群**仅靠 message 工具**向指定群（在 HEARTBEAT.md 写明 chat id，如规划群 `oc_b0f512c3328263b70ff9772c8288099f`）发一条。群里只会收到那一句。改 config 后需 `openclaw gateway restart`。手动触发时若不想整段进群则不要加 `--deliver`。

### 脚本 / launchd

- **现象**：launchd 跑的脚本退出码 127，`env: node: No such file or directory`。  
  **原因**：plist 里用 `/usr/bin/env node`，launchd 环境 PATH 不含 node。  
  **正确做法**：plist 中使用 node 的绝对路径（如 `/opt/homebrew/bin/node`），并在 `EnvironmentVariables` 中设置 `PATH`，必要时设 `HOME` 以正确解析 `~/` 路径。

- **现象**：脚本里用 `python3` 调 `send_im_message.py` 报 `ModuleNotFoundError: dotenv`。  
  **原因**：launchd 下的 `python3` 多为系统 Python，未装 dotenv。  
  **正确做法**：脚本中优先使用项目或指定目录下的 venv 解释器（如 `SEND_IM_SCRIPT_DIR/.venv/bin/python`），在 plist 中也可通过 `PATH` 或直接写 venv 的 python 路径。

### 配置与运行

- **现象**：CLI 报 device token mismatch。  
  **原因**：Gateway 用项目 config/state，但 CLI 未指定同一 config/state。  
  **正确做法**：先设 `export OPENCLAW_CONFIG_PATH=$(pwd)/.openclaw/config`、`export OPENCLAW_STATE_DIR=$(pwd)/.openclaw/state` 再执行 openclaw 命令。仍报错可 `openclaw gateway token rotate` 后 `openclaw gateway restart`（同上 env 下执行）。

- **现象**：改过 lifecoach workspace（SOUL/AGENTS/Skill）后行为异常或未按新逻辑执行。  
  **原因**：未做回归验证。  
  **正确做法**：改完后跑 `node scripts/smoke-test-lifecoach-workspace.js` 做冒烟测试，通过后再更新 CHANGELOG/DECISIONS/NOW（及本文件如需）。

### 文档与流程

- **现象**：HEARTBEAT.md 被机器人判为「文件内容为空」、仅包含注释而跳过执行。  
  **原因**：框架或模型将「仅含注释」视为空文件。  
  **正确做法**：在 HEARTBEAT.md 最顶部增加一行非注释的强制说明（如「必须执行本清单，不可跳过。以下为 xxx heartbeat 任务。」），避免被误判。

- **现象**：未验证的改动被记入 CHANGELOG/DECISIONS/NOW，后续排查依据失真。  
  **原因**：先更新文档再验证，或未做冒烟测试。  
  **正确做法**：先完成冒烟测试、确认链路打通，再更新 CHANGELOG-RUNNING / DECISIONS / NOW；若是修 bug 或纠正行为，同时在本文件（CLAUDE.md）追加一条易错点与纠正。

### Agent 互通 (sessions_send / sessions_spawn)

- **现象**：main 等 agent 调用 `sessions_send` 向 lifecoach 等发消息时，飞书/日志出现「Session Send: lifecoach failed: Either sessionKey or label is required」。  
  **原因**：`sessions_send` 必须指定**已有会话**，参数为 `sessionKey` 或 `label`，不能只传 `agentId`；只传 agentId+message 时框架会报错。  
  **正确做法**：要「问另一个 agent」且没有目标会话时，用 **sessions_spawn(agentId, task)**；只有在对已知会话发消息时才用 **sessions_send(sessionKey 或 label, message)**。AGENTS.md 通讯录已区分两工具必填参数，模型按此调用。

### Fallback 与默认模型

- **现象**：config 里 agent 的 `model.primary` 和 `model.fallbacks` 已改为 minimax/glm/deepseek，但运行时仍报「All models failed: … anthropic/claude-opus-4-6: No API key」，fallback 未按配置执行。  
  **原因**：OpenClaw 约定「若未指定 provider 则假定 anthropic」；若只配了 `agents.defaults.model.fallbacks` 而未配 `agents.defaults.model.primary`，框架在解析默认主模型时会用内置 anthropic，导致实际链变成「你配的 primary → anthropic」且未配 Anthropic key 则整轮失败。  
  **正确做法**：在 config 中显式设置 `agents.defaults.model.primary`（如 `"minimax/MiniMax-M2.5"`），并设 `agents.defaults.model.fallbacks` 仅包含你已配 key 的模型；将 `agents.defaults.models` 限定为这些模型（作为 allowlist），不包含 anthropic。改后需 `openclaw gateway restart`。

### Cron 调度

- **现象**：jobs.json 里 cron 已改为 23:00（如 `"expr": "0 23 * * *"`），但任务仍每天 21:00 触发，tomorrow_plan 在 21 点被更新。  
  **原因**：Gateway 只在启动时从磁盘加载 cron；改 jobs.json 后若不重启，内存里仍是旧 schedule（如 21:00），实际触发时间不变。  
  **正确做法**：改 cron 时间（或任何 schedule 相关字段）后，必须执行 `openclaw gateway restart`（或 launchctl unload/load plist 再 restart），让 Gateway 重新加载 `.openclaw/state/cron/jobs.json` 后 23:00 才会生效。

### 升级 / Config 兼容（v2026.2.24+）

- **现象**：升级到 OpenClaw v2026.2.24 后 Gateway 启动即退出，gateway.err.log 报 `Invalid config`、`plugin not found: feishu`、`unknown channel id: feishu`、`unknown heartbeat target: feishu`、`plugin not found: qwen-portal-auth` 等。  
  **原因**：v2026.2.24 对 config 的插件与 channel 校验更严；`plugins.entries` 里列出的 feishu / qwen-portal-auth 被当作“需从插件注册表解析”的插件，解析不到则整份 config 判为无效；feishu 通道由内置提供，不应在 entries 中重复声明。  
  **正确做法**：从 `plugins.entries` 中移除 `feishu` 与 `qwen-portal-auth` 条目（保留 `memos-cloud-openclaw-plugin` 等实际安装的插件）；保留 `channels.feishu` 与各 agent 的 `heartbeat.target/to`。改完后 `openclaw gateway install` 或 `openclaw gateway restart` 使 Gateway 重新加载 config。

- **现象**：heartbeat 或手动 `openclaw agent --deliver` 后，飞书群收到**多条**消息（分析过程、步骤说明、实际教练句等）。  
  **原因**：Gateway 投递的是助手**整段回复**，无「只投递 message 工具结果」的配置。  
  **正确做法**：该 agent 的 heartbeat 设为 **`target: "none"`**，发群仅靠 **message 工具**向 HEARTBEAT.md 中写明的群 chat id 发一条；改后 `openclaw gateway restart`。这样群里只会收到那一句（已在本仓库 lifecoach 验证）。

- **现象**：用户在群里问「在吗」等简单问题时，飞书收到两条回复：一条简短（如「在的，请说。」），另一条带**思考过程**（「用户问在吗。这是一个简单的问候…我需要：1. 立即回复…」）。  
  **原因**：OpenClaw 投递的是助手**整段回复**；若模型输出了 `thinking` 块或把推理写进正文，框架会一并发到群。部分模型（如 glm-5）会输出 reasoning 块，Gateway 未在投递时过滤。  
  **正确做法**：在该 agent 的 SOUL 中增加「回复内容」约定：**只输出面向用户的那句话**，不把内部推理、步骤说明写进回复；简单招呼直接简短回复。本仓库已在 lifecoach 的 SOUL 中加入该约定。若 config 中该 agent 所用模型启用了 `reasoning`，可关闭以避免 thinking 块被输出。

### Subagent 与 plan 文件编辑

- **现象**：规划教练说「同步完成」后，对话里又出现「Subagent fitcoach failed」/「Subagent foodcoach failed」。  
  **原因**：`sessions_spawn` 返回的是「已接单」(accepted)，子 agent 实际运行可能超时或内部报错；框架随后把失败结果以一条消息注入当前会话，所以用户会同时看到「成功」和「failed」。  
  **正确做法**：需要同步给 fitcoach/foodcoach 时用 **sessions_spawn**（勿用 sessions_send 只传 agentId）。若子任务非关键，可在 SOUL/Skill 里约定「同步失败时不阻塞主流程，可简要告知用户」；排查时看对应 agent 的 session jsonl 或 gateway 日志。

- **现象**：编辑 `tomorrow_plan/YYYY-MM-DD.md` 时出现「Edit: in ... (263 chars) failed」或 "Could not find the exact text"。  
  **原因**：`edit` 要求 `oldText` 与文件内容**完全一致**（空格、换行、表格对齐），计划文件多为多行/表格，容易因换行或空格不一致匹配失败。  
  **正确做法**：对计划文件做较大改动时，优先 **read 全文 → 在内存中拼好新内容 → write 整份文件**；若必须用 edit，只用**短且唯一**的片段（如单行标题），避免长段多行 oldText。

- **现象**：tomorrow_plan 每天格式不一致；或番茄钟/今日计划读某日计划时任务数为 0、无法正确读取。  
  **原因**：文件名未统一（如模型写成「明日日期.md」）；或内容只有列表没有 **Markdown 表格**，而 personalOS 的 schedule_loader **只解析含「时间」「任务」列的表**，列表格式会解析出 0 个任务。  
  **正确做法**：文件名**必须**为 `YYYY-MM-DD.md`（见 life-schedule-coach Skill 与 cron 消息）；写入内容**必须**包含至少一张「时间 | 任务」表格，且表格位于含该日期的标题下。Skill 已约定「计划文件内容格式（番茄钟兼容）」；cron 消息已改为显式 YYYY-MM-DD 与表格要求。若某日文件已写成纯列表，可手动补表格或让规划教练按 Skill 重新生成并 write。

- **现象**：脑暴群 @ 机器人后 agent 跑完但群里收不到回复；规划教练在规划群「正常」。 
 **原因**：规划教练在群里的可见回复来自 **heartbeat 的 message 工具**（heartbeat target: none），不经过框架投递；脑暴没有 heartbeat，回复全靠**框架投递**。框架向飞书发群时把 `group:oc_xxx` 当 receive_id 导致飞书 API 400（Invalid ids），投递失败。 
 **正确做法**：在脑暴 agent 的 SOUL 中约定「每次回复必须用 message 工具向本群 chat_id 发送」，与规划教练一致；用户即可收到回复，框架投递报错可忽略。若模型仍只回文字不调工具，需在 SOUL 中明确「禁止只输出文字」「必须先调用 message 工具」，并在 AGENTS.md 的 Group Chats 下增加「本群回复方式」提醒（chat_id 见 SOUL）。

- **现象**：在规划群「回复」规划教练的消息（如回复 heartbeat），结果接单的是 **main** 而不是 lifecoach，规则被 main 写进 data/rules 等。  
  **原因**：OpenClaw 当前按「群 → 绑定 agent」路由，未按「被回复消息的发送者」路由；回复可能被当成普通群消息走 default（main）。  
  **正确做法**：规划群内要跟规划教练说事时，**直接发新消息并 @ 机器人**，不要点「回复」某条。同一群内 lifecoach 是同一会话，教练能看到该群全部历史（含自己刚发的 heartbeat），直接 @ 即可带上文。根上修复需 OpenClaw 支持「回复谁则路由给谁」，可向上游提需求。

### 脑暴 / 搜索与可验证性（2026-02-27）

- **现象**：用户让脑暴用 tavily 搜索，机器人回复「搜索到了」并给出总结，但用户用 Google/GitHub/Twitter 等自己搜不到，误以为机器人「没搜到」或结果造假。  
  **原因**：Tavily 与 Google 等索引不同，中文/二次来源（知乎、lilys.ai、小宇宙等）在 Tavily 能命中，用户用英文关键词在 Google 可能不突出；且机器人若只给总结、不给来源链接，用户无法一键验证。  
  **正确做法**：脑暴 SOUL 已约定：报告搜索结论时**必须附带 1～3 条来源 URL**；用户说「我搜不到」时先澄清是「用户自己搜不到」还是「机器人没搜到」，若是前者可再次给出本次搜索到的链接并说明不同引擎结果可能不同。日志中工具执行成功即表示「机器人搜到了」，与「用户能否在自己用的引擎里复现」是两件事。

### 更新检查与发群（2026-02-28）

- **现象**：`update-check-and-notify.js` 跑完有中文报告但未写入 `update-check-report.md`、也未发到脑暴群。  
  **原因**：检查脚本解析的是 `--write-report=路径`（单参数带等号），wrapper 传的是 `'--write-report', REPORT_PATH`（两个参数），导致 `writeReportPath` 为 null，不写文件；发群逻辑依赖「报告文件存在且含 → 最新版本」才发送。  
  **正确做法**：调用检查脚本时传**单参数**：`'--write-report=' + REPORT_PATH`，不要拆成两个数组元素。

### plist 必须包含 API key、写 personalOS 用 exec（2026-02-28）

- **现象**：Gateway 重启后所有模型报 401（MiniMax、Qwen、DeepSeek 全挂），但直接 curl 测试 key 是通的。  
  **原因**：Gateway plist 的 `EnvironmentVariables` 中没有 API key（MINIMAX_API_KEY 等），旧进程靠安装时 shell 环境有 key，launchctl unload/load 后新进程只有 plist 里的变量——API key 全丢。  
  **正确做法**：plist 的 `EnvironmentVariables` 中**必须**包含所有 config 里 `${...}` 引用的 API key。改 .env 后同步更新 plist，再 unload/load。

- **现象**：lifecoach 回复 "Write: to ~/personalOS/data/tomorrow_plan/... failed"，但文件实际被更新了。  
  **原因**：`write`/`edit` 工具受 workspace 沙箱限制，写 workspace 外路径报 "Path escapes workspace root"；模型随后用 `exec`（`cat > ...`）兜底成功。软链接方案也不行——框架会检测 symlink 逃逸并拒绝。  
  **正确做法**：Skill 中明确指引：写 personalOS 文件时用 `exec`（`cat > 路径 << 'EOF'`），不用 write/edit。workspace 内文件（heartbeat_logs、memory 等）继续用 write。

- **现象**：agent 间 `sessions_spawn` 成功但子 agent 回复"所答非所问"。  
  **原因**：主模型（MiniMax）失败后，框架 failover 时将原始 prompt 替换为 "Continue where you left off. The previous model attempt failed or timed out."——子 agent 从未收到原始任务内容。  
  **正确做法**：确保 fallback 链中所有模型的 API key 有效、有余额，减少 failover 发生。当 failover 不可避免时，注意子 agent 回复可能丢失上下文。

### vestcoach 适应期与内容质量（2026-02-28）

- **现象**：vestcoach Day 1 heartbeat 告诉用户「你持仓腾讯 10 股」，但用户从未买过；今日一课教「什么是股票」，用户觉得太空洞没营养。  
  **原因**：① 测试账户（account_id=21）在开发调试时有一笔测试买入（0700.HK 10 股），heartbeat 拉到账户数据后误判为「首次买入后第一天」场景。② HEARTBEAT.md 的开场场景没有按 21 天阶段区分——适应期 Day 1-3 不应有持仓，应走「认识市场」路径。③ 今日一课只是百科式概念定义，与 brainstorming 约定的「知识点从实盘带出」不一致。  
  **正确做法**：① 早上开场/收盘复盘由 **Cron** 定时触发（08:30/16:30），不是 Heartbeat；Heartbeat 仅用于盘中异常监控（每 30m，09:30-16:00）。HEARTBEAT.md 中不应有「判断当前时段」逻辑，cron 已经在正确的时间触发了。② 执行时先判阶段（读 MEMORY.md start_date）：适应期 Day 1-3 走专用场景（认识市场/账户/个股），不依赖持仓数据；仅 Day 4+ 走持仓场景。③ 今日一课禁止百科式空讲，必须包含真实数据（新闻标题/股票价格/指数涨跌）+ 一个给用户的小任务。④ 新 agent 上线前必须清除测试数据（假持仓、假订单）或新建干净账户。

- **现象**：HEARTBEAT.md 里写了「判断当前时段：08:30-09:30 做早上开场，16:30-17:30 做复盘，其他时段 HEARTBEAT_OK」，让 heartbeat 自己判断该做什么。  
  **原因**：混淆了 OpenClaw 的 Cron 和 Heartbeat 概念。Cron 是固定时间触发（如每天 08:30），Heartbeat 是周期性触发（如每 30 分钟）。早上开场和收盘复盘应由 Cron 触发，不应在 heartbeat 里用时间判断来模拟定时。  
  **正确做法**：Cron（jobs.json）在 08:30/16:30 触发 vestcoach 执行对应逻辑；Heartbeat（config `every: "30m"`）仅在盘中交易时段做异常监控。HEARTBEAT.md 作为统一参考文档，要明确标注每节由什么触发（「Cron 08:30 触发」vs「Heartbeat 每 30 分钟触发」），不要在文件里写时间判断逻辑。

### MemOS 插件禁止本地 MEMORY.md 写入（2026-02-28）

- **现象**：各 agent（lifecoach/fitcoach/foodcoach 等）的本地 MEMORY.md 从未被更新，蜂群协同缺乏历史上下文，用户确认的偏好/目标/行为模式只存在 MemOS Cloud 但不在本地。 
  **原因**：MemOS 插件 `memos-cloud-api.js` 第 396 行注入的第 4 条 Attention 明确写了「Do not read from or write to local MEMORY.md or memory/* files」，直接禁止了 agent 使用本地记忆文件。 
  **正确做法**：将该指令改为「鼓励写入 MEMORY.md」——当用户确认重要事实/偏好/目标/行为模式时，agent 应用 write 工具追加到本 workspace 的 MEMORY.md；但不要 bulk-read `memory/YYYY-MM-DD.md` 日志文件。**两个副本必须同步修改**（`.plugins/MemOS-Cloud-OpenClaw-Plugin/lib/memos-cloud-api.js` 与 `.openclaw/state/extensions/memos-cloud-openclaw-plugin/lib/memos-cloud-api.js`），否则 Gateway 重启后 installed 副本覆盖源码改动。同时需在各教练 SOUL 中写明触发条件、写入路径与不触发条件。

### OpenClaw 升级兼容（2026-03-02）

- **现象**：升级到 v2026.3.1 后 Gateway 启动即退出，报 `Gateway start blocked: set gateway.mode=local (current: unset)`。 
  **原因**：v2026.3.1 新增 `gateway.mode` 必填校验；plist 使用 `~/.openclaw/config`（用户级），该 config 的 `gateway` 块只有 `auth`，缺少 `"mode": "local"`。项目级 config 有该字段，但 plist 不指向项目 config。 
  **正确做法**：升级后若 Gateway 不起，先看 `gateway.err.log` 末尾，如果报 `Gateway start blocked`，在 plist 指向的 config（`~/.openclaw/config`）的 `gateway` 下补 `"mode": "local"`，然后重启 Gateway。

- **现象**：升级到 v2026.3.1 后，设有 `delivery.mode: "none"` 的 cron 任务无法通过 message 工具发群，投资群等收不到消息。 
  **原因**：v2026.3.1 breaking change：`delivery.mode: "none"` 时框架会**禁用** agent 的 message 工具，导致 agent 调用 message 工具发群静默失败。原来 vestcoach 早盘/收盘 cron 依赖 delivery=none + message 工具的组合，升级后不再有效。 
  **正确做法**：升级前检查所有 `delivery.mode: "none"` 的 cron 任务是否依赖 message 工具发群；若依赖，改为 `delivery.mode: "announce" + channel + to`（框架投递），同时更新对应 HEARTBEAT.md/SKILL 中「用 message 工具发群」的指引为「直接输出，框架 announce 投递」，避免框架 + message 工具双发。

- **现象**：升级或重装 Gateway 后 main（或任意）agent 报 `No API key found for provider "anthropic"`，但 config 里 model 明明配了 minimax/qwen/deepseek。 
  **原因**：有两处可能同时缺失：① plist 指向**用户级** `~/.openclaw/config`，该 config 的 `agents.defaults` 无 `model` 块，框架默认 anthropic；② plist `EnvironmentVariables` 没有 API key（MINIMAX_API_KEY / QWEN_API_KEY / DEEPSEEK_API_KEY 等），即使配了 model 也调不了。 
  **正确做法**：每次（重）安装 Gateway 或修改 plist 后必须检查两处：① `~/.openclaw/config` 的 `agents.defaults.model.primary` 是否显式设为非 anthropic 模型；② plist `EnvironmentVariables` 是否包含 MINIMAX_API_KEY、QWEN_API_KEY、DEEPSEEK_API_KEY、ZAI_API_KEY、MEMOS_API_KEY、TAVILY_API_KEY、FEISHU_APP_ID/SECRET、TZ=Asia/Shanghai。两处都缺则都补，launchctl unload/load 后 gateway 重启。

- **现象**：同一浏览器书签打开 `http://<ip>:18789` 时，Dashboard 频繁出现 token mismatch/401，且 `openclaw dashboard --no-open` 给出的 URL token 与 Gateway 实际 token 不一致。 
  **原因**：机器同时存在项目级与用户级两套 config/state；`openclaw dashboard` 默认读 `~/.openclaw/config` 生成 URL，而 Gateway 可能由 plist 指向项目级 `.openclaw/config`。若两份 `gateway.auth.token` 不一致，就会出现「URL token」和「网关验签 token」错位。 
  **正确做法**：固定 Gateway 的单一配置来源（推荐 plist 指向项目 `.openclaw/config/.state`），并将 `~/.openclaw/config` 的 `gateway.auth.token` 与运行中的 Gateway token 对齐；验证标准为：带/不带项目 env 执行 `openclaw dashboard --no-open` 都输出同一 token。

### Cron 投递一致性（2026-03-03）

- **现象**：cron 已配置 `delivery.mode: "announce"`，但 payload 里又要求「用 message 工具发到本群」，任务容易出现超时、双发或投递行为不稳定。  
  **原因**：同一任务同时混用两套发群通道（框架 announce + message 工具），模型执行路径变复杂，且两者在升级后行为边界并不总一致。  
  **正确做法**：二选一并保持一致。若用 `announce`，payload 明确「直接输出，由框架投递」，不要再要求 message 工具；若必须由 message 工具发群，则把 delivery 改为 `none` 并在 SOUL/Skill 中单通道约束。改完后重启 Gateway，并手动 `openclaw cron run <id>` 冒烟验证。

- **现象**：同一类 cron 任务成批复制时，只修 1-2 条样本，剩余任务会继续复现同类故障（比如 `food-int-*` 仍超时/投递失败）。  
  **原因**：批量模板任务共用同一 payload 文案，局部修复无法覆盖整批。  
  **正确做法**：遇到模板化 cron（如 `food-int-*`）要一次性批量改完并抽样冒烟至少 2 条（不同 agent/不同时段各 1 条），再更新 CHANGELOG/DECISIONS/NOW。

### tomorrow_plan 路径迁移（2026-03-03）

- **现象**：只修改了 lifecoach 的写入路径，但 fitcoach cron 仍读旧路径（或同批 cron 只改了部分），导致「规划已写入、运动教练仍读不到」与间歇性 ENOENT。  
  **原因**：tomorrow_plan 是跨 agent 共用数据，涉及 SOUL/Skill/HEARTBEAT、cron payload、兜底脚本与历史文件迁移；局部替换会留下断链。  
  **正确做法**：迁移时必须一次性全链路修改：统一到 `.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`，同步更新 lifecoach+fitcoach 文案与 `jobs.json`，迁移历史文件，并跑 `node scripts/smoke-test-lifecoach-workspace.js` + `jobs.json` 语法校验后再更新 CHANGELOG/DECISIONS/NOW。

### workspace 外文件读取（2026-03-03）

- **现象**：计划已迁到 workspace 内，但读取 `daily_summary`/`30day`/`rules` 仍偶发失败，导致 cron 结果不稳定。  
  **原因**：这些文件仍在 `/Users/zhangshuo/personalOS/...`（workspace 外）；不同 agent/workspace 下对外部路径读取稳定性不一致。  
  **正确做法**：把外部路径读取统一为 **exec + cat**（尤其 `daily_summary`）；`read/write` 仅用于 workspace 内文件。同步修改 Skill/HEARTBEAT/cron payload，避免同一链路混用两种读取策略。

### Feishu 新群接入（2026-03-03）

- **现象**：新增了飞书群 ID，但人生导师收不到该群消息（尤其会议纪要机器人发的内容）。  
  **原因**：只改了 `bindings` 或只改了 `groups` 其中一处；或者该群保留 `requireMention: true`，而纪要机器人不会主动 `@` OpenClaw 机器人。  
  **正确做法**：新群接入必须同时完成两步：① 在 `bindings` 里把该群绑定到目标 agent；② 在 `channels.feishu.groups` 注册该群。若要接会议纪要机器人这类无 @ 消息，需对该群关闭 `requireMention`，然后 `openclaw gateway restart` 并做 `config validate + status` 冒烟。

- **现象**：反思群里能看到用户发言，但人生导师不回复；日志里是 `did not mention bot`。  
  **原因**：该群仍配置 `requireMention: true`，而用户 @ 的对象可能不是 OpenClaw 机器人（或纪要机器人消息本身不会 @）。  
  **正确做法**：对于需要“群内任意新消息都可触发”的场景（反思/纪要），将对应群在 `channels.feishu.groups` 设为 `{}` 关闭强制 @，并重启 Gateway 验证派发日志。

- **现象**：私信能正常回复，但多个群绑定 workspace 集体不回复；gateway.log 可见 `feishu[default]: received message ... (group)`，却没有对应 `dispatching to agent`。  
  **原因**：`bindings` 只配置了 `accountId=main`，而实际入站消息部分走 `accountId=default`，导致群路由匹配不到目标 agent。  
  **正确做法**：按群绑定时同时配置 `accountId=main` 与 `accountId=default` 两条（或确保实际入站账号与 bindings 一致），并补 `main <- feishu accountId=default` 兜底；修改后 `openclaw gateway restart`，再用 `openclaw agents bindings` 与日志确认生效。

### personalOS 合并单仓（2026-03-04）

- **现象**：明明已把 `personalOS` 数据迁到本仓库，cron/Skill 仍偶发读旧路径（`/Users/zhangshuo/personalOS/...`），导致新环境（Docker/工作机）报文件不存在。  
  **原因**：只迁了数据，没同步改全链路引用（Skill、HEARTBEAT、`jobs.json` payload、脚本默认路径）。  
  **正确做法**：迁移后必须一次性替换整条链路到 `.openclaw/workspace-lifecoach/data/personalos/`，并跑三项冒烟：`migrate-personalos-into-workspace.js`、`smoke-test-lifecoach-workspace.js`、`jobs.json` 语法校验；全部通过后再更新 CHANGELOG/DECISIONS/NOW。
