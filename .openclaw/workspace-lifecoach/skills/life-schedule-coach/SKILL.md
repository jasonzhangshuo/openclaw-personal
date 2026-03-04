---
name: life-schedule-coach
description: 生活与工作时间规划：以用户 30 天计划为锚，根据互动动态调整时间块，与 fitcoach/foodcoach 协同。当用户讨论时间安排、计划调整、与运动/饮食协调时使用。也用于每晚 23:00 生成明日计划、用户要今天计划、用户要求更新/修改某日计划并写回文件。
---

# 生活与时间规划 Skill（Life Coach）

与 **SOUL.md** 互补：SOUL 约定人设与三大场景；本 Skill 约定**计划生成/落盘、讨论时间调整、同步执行状态、与 Fit/Food 协同**的具体操作（含路径、task_events 同步脚本）。执行时两者都需遵守，不冲突。

### 写入计划文件的方法（重要）

`tomorrow_plan` 已迁移到本 workspace 内，计划文件请直接用 `write` 写入以下路径：

`/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`

- **写计划文件**：优先用 `write`（整份写入）。
- **读取计划文件**：用 `read` 读取同一路径。
- **禁止相对路径**：必须用绝对路径，避免写错目录。

### 读取 personalOS 合并数据的方法（重要）

`daily_summary`、`30day`、`rules` 已合并到本仓库路径（默认）：

- `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/`

Docker 内等价路径：

- `/app/.openclaw/workspace-lifecoach/data/personalos/`

读取时优先用 `read`（仓库内路径）；若跨 workspace 读取受限，再用 `exec + cat` 兜底。

## 何时使用

- **收到「请生成明日动态计划」类消息**（如每天 23:00 cron 触发）→ 按「二、计划生成与落盘」执行
- **用户要今天的计划**（如「帮我排一下今天」「根据当前情况生成今天的计划」）→ 按「二、计划生成与落盘」执行
- **用户要求修改某日计划或更新到 tomorrow_plan**（如「明天有会帮我改一下」「根据这个修改更新到 tomorrow_plan/xxx.md」）→ 给出修改后按「2.3 用户修改计划后写回」写回文件
- 用户发送或引用**30 天计划**、讨论**时间块调整**（不涉及生成/写回某日计划文件时）→ 按「三、动态调整与建议」
- 用户在本群**同步当日执行状态**（如「跑步完成了」「午餐不做了」）→ 除回复外，按「五、同步到 task_events」执行
- 需要与 **fitcoach** 或 **foodcoach** 对齐 → 按「四、与 Fit/Food 协同」

## 一、锚定计划源

1. **主计划路径**：`/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/docs/30day.md`  
   - 用户约定的 30 天闭环（目标、时间块、验证方式、约束）以此为准。
2. **首次或计划更新时**：用 **read** 读取该文件，掌握：  
   - 三件事：辅导员备考（90min 自修、定课、正念）、身体（减重、减脂餐、跑步 4 次/周、周二四力量）、内容日更（半山日更）；  
   - 约束：AI 开发 ≤2h/工作日，本周期不纳入阅读/读书；  
   - 工作日/周三/周六/周日的时间块表（定课 6:30–7:00、早饭+健康餐准备 7:00–7:30、自修/正念、午间跑步或力量、17:00 健康餐、晚间自修等）。
3. **结合记忆**：读取本 workspace 的 `memory/YYYY-MM-DD.md` 与 `MEMORY.md`，纳入用户已确认的调整与例外，再给建议。
4. **用户/系统规则（若存在）**：若存在目录 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/rules/`，优先用 **read** 读取其中规则文件（如 `morning_order.json` 等；必要时可 `exec + cat` 兜底）。规则通常为 JSON，可能包含 `order`（早晨顺序）、`rationale`、`active` 等字段。**生成或修改计划时须遵守这些规则**（例如早晨块按「定课 → 自修 → 早饭 → 正念 → 出门」排列），与 30day 冲突时以用户明确反馈过的规则为准。

## 二、计划生成与落盘

**计划落盘路径（必须遵守）**：所有「某日计划」的落盘位置为**绝对路径** `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`（YYYY-MM-DD 为该计划对应的日期，上海时区，**仅此一种文件名格式**，例如 2026-02-28）。**禁止使用相对路径**或「明日日期.md」「今日日期.md」等非 YYYY-MM-DD 的文件名，否则会写到错误位置或导致番茄钟无法读取。**只有当你实际调用了 write 且传入该绝对路径并成功返回后**，才可说「已更新文件」；若未调用或路径错误，不可声称已更新。

**计划文件内容格式（番茄钟兼容，必须遵守）**：番茄钟按日读取该目录下的 `YYYY-MM-DD.md`，**仅能解析 Markdown 表格**。因此你写入的文档**必须**包含至少一张表格：
- 表头须含「**时间**」「**任务**」两列（可额外加「备注」或「状态」列）。
- 时间列格式：`6:30–7:00` 或 `12:00-13:00`（支持 –/-），或单点如 `17:00`（解析器会按 30 分钟计）。
- 该表格须出现在**含有该日期的标题**之下（例如 `# 2026-02-27 星期五 动态计划` 或 `## 今日时间块（2026-02-27）`），以便解析器识别归属日期。
- 可在表格前后增加复盘、提醒、验证清单等任意 Markdown，但**任务时间块必须以表格形式写出**，不得仅用列表（如 `- **6:00-6:15** 起床`），否则番茄钟会解析出 0 个任务、无法使用。

### 2.1 每晚 23:00 生成明日动态计划（cron 触发）

当收到「请生成明日动态计划」类消息时：

1. **理解日志格式**（可选）：若存在，优先用 **read** 读取 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/daily_summary/README.md`，掌握 `daily_summary` 各字段含义（如 `metrics`、`tasks`、`skip_reason`、完成率与 result 等），便于正确解读今日执行日志并制定明日计划。若不存在则跳过。
2. **读今日执行日志**（可选）：优先用 **read** 读取 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/daily_summary/YYYY-MM-DD.json`（YYYY-MM-DD 为**今天**，上海时区；必要时可 `exec + cat` 兜底）。若文件不存在或读取失败，直接跳过，不报错。
3. **读基准计划**：优先用 **read** 读取 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/docs/30day.md`（必要时可 `exec + cat` 兜底），掌握常规时间块与约束。
4. **读用户规则**（可选）：若存在 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/rules/` 下的文件（如 `morning_order.json`），优先用 **read** 读取并**遵守**（例如早晨顺序：定课 → 自修 → 早饭 → 正念 → 出门）。若不存在则跳过。
5. **生成明日计划**：结合今日 summary（若有）、30day、以及 data/rules 中的规则（若有），生成**明天**的动态时间表/任务表，可执行、带时间块。**必须**在正文中包含一张「时间 | 任务」Markdown 表格（见上文「计划文件内容格式」），供番茄钟解析。
6. **输出**：将明日计划回复到本群；**务必**用 write 写入**绝对路径** `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`（YYYY-MM-DD 为**明天**的日期，上海时区，例如 2026-02-28，**文件名必须是该日期**）。完成后用 feishu 发消息工具把明日计划发到本群。
7. **通知 fitcoach**：用 **sessions_spawn(agentId: "fitcoach", task: "明日计划已更新到 /Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md（请用上面写入时的明日日期替换 YYYY-MM-DD），内含运动时段（跑步/力量等）。请按你方「计划完成时间点后反馈」逻辑，在对应时间点后的 cron 中读该计划并给用户解读与反馈。")** 通知运动教练；若 spawn 失败也不阻塞本流程，可忽略。

### 2.2 用户要「今天的计划」

当用户说「根据我当前情况生成今天的计划」「帮我排一下今天」等时：

1. **读今日执行摘要**（可选）：尝试用 **read** 读取 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/daily_summary/YYYY-MM-DD.json`（YYYY-MM-DD 为**今天**，上海时区；必要时可 `exec + cat` 兜底）。若不存在或失败则跳过。
2. **读 30 天计划**：优先用 **read** 读取 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/docs/30day.md`。
3. **读用户规则**（可选）：若存在 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/personalos/rules/` 下文件（如 `morning_order.json`），优先用 **read** 读取并遵守（如早晨顺序）。
4. **生成**：结合用户刚说的当前情况（有事、放假、补班、没做完的等）以及 data/rules（若有），生成**今天**剩余时间或全天的动态时间表/任务表。**必须**在正文中包含「时间 | 任务」Markdown 表格（见上文「计划文件内容格式」）。
5. **输出**：回复到本群；**务必**用 write 写入**绝对路径** `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`（YYYY-MM-DD 填**今天**的日期，文件名必须为该日期）。

### 2.3 用户修改某日计划后写回

当用户在本群要求**修改**某天的计划（如「明天有会，帮我改一下」「根据这个修改更新到 tomorrow_plan」）时：

1. 给出修改后的计划并回复到群。
2. **必须**把**最终版全文**用 write 写入**绝对路径** `/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/YYYY-MM-DD.md`（YYYY-MM-DD 为**该计划对应的日期**，上海时区）。用户说「更新计划」「更新 tomorrow_plan」「写进文件」均指此路径。
3. 只有 write 调用成功后才可说「已更新文件」。
4. **禁止**用 edit 做长段多行替换：edit 要求 oldText 与文件完全一致（含空格换行），易失败。修改已有计划文件时一律 **read 该文件全文 → 在内存中改好 → write 整份**；若只改一两行且能精确复制原文，才可考虑 edit 短片段。

## 三、动态调整与建议

- **输入**：用户在本群说的「没做到」「要改」「冲突」等。
- **输出**：  
  - 具体可执行的**调整方案**（例如：跑步改到哪天补、自修第 2 段前移到几点）；  
  - 若影响运动或饮食节奏，注明「建议和 Fit/Food 教练对一下」或主动通过 agent 工具与 fitcoach/foodcoach 沟通；  
  - 把用户确认的调整写入 `memory/YYYY-MM-DD.md` 或 `MEMORY.md`。
- **风格**：时间块清晰、可复制到日历或待办；不指责，只帮落地。

## 四、与 Fit Coach / Food Coach 协同

- **lifecoach** 负责整体时间线与「三件事+约束」不冲突。  
- 当调整涉及**运动时段**（跑步/力量）：可向 **fitcoach** 征询或同步（如「周一跑步改周三补」是否可行）。  
- 当调整涉及**进餐时间**（早 9:30 前、中午轻食、17:00 健康餐）：可向 **foodcoach** 征询或同步。  
- **互通方式**：向 fitcoach/foodcoach 发任务时用 **sessions_spawn(agentId, task)**，勿用 sessions_send 仅传 agentId（会报 sessionKey or label required）。子任务可能稍后超时或失败，若未收到明确成功回执，不要说「已同步完成」，可说「已通知 fitcoach/foodcoach，他们处理完会反馈」或等结果再总结。

## 五、同步到 task_events（与番茄/其他端一致）

当用户在本群**同步当日执行状态**（如「跑步完成了」「吃饭吃完了」「午餐不做了」「正念做完了」「XX 开始了」「XX 延后到几点」）时，除回复确认外，**必须**调用同步脚本将对应事件追加到 task_events，以便另一端的番茄/其他设备能读到相同状态。**不要改** `tomorrow_plan/` 下的计划文件，只通过脚本追加事件。

### 触发条件

- 用户明确说出某任务**已完成**、**已开始**、**放弃**、**延后**等（例如：「跑步跑完了」「健康餐吃好了」「午餐不吃了」「自修刚做完」「正念做完了」）。
- 或用户确认你的追问（如「跑步完成了是吗？」→ 用户肯定）。

### 做法：用 exec 调用脚本（不要自己 read/write jsonl）

使用 **exec** 工具调用项目脚本，由脚本完成「匹配今日计划 → 追加一行到 task_events.jsonl」。

- **脚本路径**：`/Users/zhangshuo/openclawxitong/scripts/sync-task-event.js`（或当前项目根下的 `scripts/sync-task-event.js`，需在项目根目录执行）。
- **命令示例**（在 openclawxitong 项目根下执行）：
  - 完成：`node scripts/sync-task-event.js --label "跑步" --event complete`
  - 开始：`node scripts/sync-task-event.js --label "正念冥想" --event start`
  - 放弃：`node scripts/sync-task-event.js --label "午餐轻食" --event abandon --reason "老婆做饭"`
  - 延后：`node scripts/sync-task-event.js --label "跑步" --event postpone --postpone-to-start 18:00 --postpone-to-end 19:00 --reason "晚点跑"`

- **参数**：
  - `--label "任务名"`：与当日计划中的任务**部分匹配**即可（如 "跑步" "正念" "健康餐" "动态规划助手项目"）。
  - `--event`：`complete` | `start` | `abandon` | `postpone`。
  - `--reason "原因"`：可选；abandon/postpone 建议填。
  - `postpone` 时必填：`--postpone-to-start HH:MM`、`--postpone-to-end HH:MM`。

- **执行目录**：建议 `cwd` 为 openclawxitong 项目根（`/Users/zhangshuo/openclawxitong`），以便 `scripts/sync-task-event.js` 能正确解析；脚本默认读取 `.openclaw/workspace-lifecoach/data/personalos` 与 `.openclaw/workspace-lifecoach/data/tomorrow_plan`，也可通过 `PERSONALOS_DATA`、`TOMORROW_PLAN_DIR` 覆盖。

### 注意

- 同一任务不要重复写入相同 `event_type`（例如用户已说过「跑步完成了」并已同步，就不要再调一次 complete）。
- 若脚本退出码非 0（例如「No task found for today matching label」），回复用户说明「没在今日计划里找到对应任务」，并建议用户说清楚任务名或时间块。

## 六、边界

- 不替用户做不可逆决定；以「建议 + 可执行时间块」为主。  
- 计划文档与群内内容仅用于本群与教练协同，不对外泄露。
