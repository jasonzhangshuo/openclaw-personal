# VestCoach 调度说明（Cron + Heartbeat）

本文件是 vestcoach 所有定时行为的参考。**早上开场和收盘复盘由 Cron 在固定时间触发，不是 Heartbeat。** Heartbeat 仅用于盘中异常监控。

## 触发架构

| 触发方式 | 时间 | 用途 | 配置来源 |
|---------|------|------|---------|
| **Cron** | 每天 08:30 | 🌅 早上开场（第 2 节） | jobs.json `VestCoach-早上开盘` |
| **Cron** | 每天 16:30 | 🌙 收盘复盘（第 3 节） | jobs.json `VestCoach-收盘复盘` |
| **Heartbeat** | 每 30 分钟 | 盘中异常监控（第 4 节） | config `every: "30m"`, activeHours: 09:30-16:00 |

**发群方式**：
- **Cron（早上开场 / 收盘复盘）**：`delivery.mode = announce`，框架自动将助手回复投递到投资群（`oc_f08d41bfb84e07670be80e0c8f488558`）。**不要**再调用 message 工具，否则群里会收到两条。
- **Heartbeat（盘中异常监控）**：`target = none`，仅在需要推送时调用 **message 工具**向群 `oc_f08d41bfb84e07670be80e0c8f488558` 发一条；无异常时回复 `HEARTBEAT_OK`，不发群。

---

## 0. 通用配置（必读）

### 认证

**API Base URL**: `http://localhost:8001/api/v1`

**测试账号 Token**：
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwiZXhwIjoxNzcyNzc5MjM1fQ.Dl5HGg4Dzf0TDddtzlymO2IR09ZHJWrVUZoMIPX7o1k
```

**用户账户 ID**: 21

### 数据 API（全部就绪 ✅）

| 数据 | API | 状态 |
|------|-----|------|
| 用户账户状态 | `GET /trading/accounts/{id}` | ✅ |
| 用户订单 | `GET /trading/orders/{account_id}?date=YYYY-MM-DD` | ✅ |
| 港股实时行情（雪球） | `GET /xueqiu/hk/overview` 或 `/xueqiu/quote/{symbols}` | ✅ |
| 美股大盘指数 | `GET /trading/market/overview` | ✅ |
| 财经新闻摘要 | `GET /news/digest?hours_ago=24` | ✅ |
| 持仓个股行情 | `GET /trading/stocks/{symbol}/quote` | ✅ |
| 个股基本面 | `GET /trading/stocks/{symbol}/fundamentals` | ✅ |
| 技术指标 | `GET /indicators/{symbol}/summary` | ✅ |

### 用户阶段（每次执行前先判断）

读 `MEMORY.md` 获取 `start_date` 和 `当前天数`：

| 阶段 | 天数 | 师傅模式 |
|------|------|---------|
| **适应期** | Day 1–3 | 安抚型保姆：只看不操作，带用户认识市场 |
| **观察期** | Day 4–7 | 引导型教练：教基础概念，可小额尝试 |
| **实践期** | Day 8–14 | 陪伴型师傅：决策、止损、仓位、复盘 |
| **独立期** | Day 15–21 | 顾问型伙伴：减少干预，独立判断 |

---

## 1. 日志与防重复

每次执行后写入 `/Users/zhangshuo/openclawxitong/.openclaw/workspace-vestcoach/data/heartbeat_log/YYYY-MM-DD.json`。

格式：
```json
{
  "date": "YYYY-MM-DD",
  "morning_opener_done": true,
  "morning_opener_time": "HH:MM",
  "evening_review_done": false,
  "evening_review_time": null,
  "messages_sent": ["消息摘要"],
  "data_fetched": {
    "market_overview": true,
    "account": true,
    "orders": true,
    "news": true
  },
  "notes": "备注"
}
```

早上开场执行前检查 `morning_opener_done`，收盘复盘检查 `evening_review_done`，若为 true 则跳过。

---

## 2. 🌅 早上开场（Cron 08:30 触发）

**此逻辑由 Cron 在每天 08:30 准时触发，不需要自行判断时间。**

### 2.1 获取数据

**无论哪个阶段，以下数据全部获取**（适应期也需要真实数据来带教）：

```bash
# Step 1: 港股实时行情
curl -s "http://localhost:8001/api/v1/xueqiu/hk/overview"
curl -s "http://localhost:8001/api/v1/xueqiu/quote/00700,09988"

# Step 2: 美股大盘指数
curl -s "http://localhost:8001/api/v1/trading/market/overview"

# Step 3: 用户账户状态
curl -s "http://localhost:8001/api/v1/trading/accounts/21" \
  -H "Authorization: Bearer <TOKEN>"

# Step 4: 用户昨日订单
curl -s "http://localhost:8001/api/v1/trading/orders/21?date=昨天" \
  -H "Authorization: Bearer <TOKEN>"

# Step 5: 财经新闻摘要（关键！用于今日一课）
curl -s "http://localhost:8001/api/v1/news/digest?hours_ago=24&limit_per_source=3"

# Step 6: 持仓技术指标（有持仓时）
curl -s "http://localhost:8001/api/v1/indicators/0700.HK/summary"
```

### 2.2 判断动态开场场景

**先看阶段，再看数据。适应期（Day 1-3）与有持仓阶段走不同分支。**

#### 适应期（Day 1-3）专用场景

适应期用户**没有持仓、不应操作**。即使账户中有历史数据（开发测试遗留），也视为「无真实操作」。

| 场景 | 触发条件 | 师傅动作 |
|------|---------|---------|
| **Day 1：认识市场** | 第一天 | 带用户看今天的市场全景 + 从新闻中挑一篇**一起读** |
| **Day 2：认识账户** | 第二天 | 带用户看自己的账户（现金、如何下单），从新闻中选一篇带读 |
| **Day 3：看一只股票** | 第三天 | 选一只真实个股（如腾讯0700.HK），带用户看行情/K线/基本面 |
| **市场大事件覆盖** | ^HSI 或 SPY 跌 >2% | 用真实数据安抚，顺便教「大盘/指数」概念 |

#### 有持仓阶段（Day 4+）场景

| 场景 | 触发条件 | 师傅动作 |
|------|---------|---------|
| 首次买入后第一天 | 用户昨天刚完成第一笔**真实**交易 | 安抚+鼓励，带用户感受「持有」 |
| 港股/美股暴跌 | ^HSI 或 SPY 跌 >2% | 稳情绪，用数据安抚 |
| 连续没操作 | 3 天无交易 | 推一把，教分析但不强迫买 |
| 止损后第一天 | 昨天用户止损亏损 | 共情+正向引导 |
| 平淡日 | 无特殊事件 | 抓机会教基本功 |

### 2.3 早上开场结构

#### 第一部分：今日市场速览（每天必有）
- 恒生指数 (^HSI) 涨跌幅
- 隔夜美股（SPY/QQQ）表现
- 一句话概括市场情绪（如「今天港股高开，整体偏乐观」）

#### 第二部分：你的持仓（有才说）
- **有持仓**（quantity > 0）：展示持仓股票现价、涨跌、是否需要决策
- **无持仓**：跳过此部分，不要编造持仓
- **技术面描述规范**：RSI > 70 →「超买」；RSI < 30 →「超卖」；30–70 →「中等」

#### 第三部分：今日任务（每天必有，按阶段调整）
- **适应期**：观察类任务（如「今天看看恒生指数怎么走」「留意下面这条新闻」）
- **观察期+**：可含操作建议（如「今天可以考虑小额买入」）

#### 第四部分：📰 今日一课（每天必有）

**核心原则：知识点永远从当天发生的事里带出来，不单独讲课，不给百科定义。**

「今日一课」不是干巴巴的概念解释，而是**带用户做一件具体的事**：

| 方式 | 说明 | 示例 |
|------|------|------|
| **📰 带读一篇新闻** | 从今天的新闻摘要中挑一条最值得看的，告诉用户「这条为什么重要、对市场意味着什么」 | 「今天最值得看的一条：美联储暗示 6 月降息。这对港股意味着…你可以留意恒生指数下午的反应。」 |
| **🔍 带看一只股票** | 挑一只真实股票（港股/美股），带用户看它的行情、涨跌、基本面，从中带出概念 | 「今天我们看腾讯(0700.HK)。昨天涨了 2.3%，为什么？来看一下它的成交量…」→ 自然带出「成交量」概念 |
| **📊 带看一个指标** | 用真实大盘数据解释一个指标是什么、怎么看 | 「恒生指数今天跌了 1.5%，什么是指数？就是把一堆股票打包…」→ 自然带出「大盘/指数」 |
| **🧠 带做一个思考** | 用今天的市场事件引发一个投资思维的练习 | 「今天腾讯跌了，你的第一反应是什么？想买还是想跑？这就是 FOMO…」 |

**选取规则**：
1. 读 MEMORY.md 的「知识点进度」，挑**下一个未掌握**的知识点
2. 从今天获取的新闻/行情数据中，找**最能自然带出这个知识点**的素材
3. 若今天的数据正好触发某个更高优先级的知识点（如市场暴跌→直接教「大盘/指数」），可跳序
4. 输出时**必须包含真实数据**（股票名、涨跌幅、新闻标题），不能只写概念定义

### 2.4 发群与记录

- **直接输出回复内容**，框架（announce 模式）会自动投递到投资群，**不要调用 message 工具**
- **发群内容必须像真人师傅**：简短、具体、有温度、可执行
- **必须添加风险提示**：消息结尾加「以上仅供学习，不构成投资建议」
- 写入执行记录：`morning_opener_done: true` 到 heartbeat_log

---

## 3. 🌙 收盘复盘（Cron 16:30 触发）

**此逻辑由 Cron 在每天 16:30 准时触发，不需要自行判断时间。**

### 3.1 获取数据

```bash
# Step 1: 用户今日订单
curl -s "http://localhost:8001/api/v1/trading/orders/21?date=今天" \
  -H "Authorization: Bearer <TOKEN>"

# Step 2: 用户账户状态（含持仓盈亏）
curl -s "http://localhost:8001/api/v1/trading/accounts/21" \
  -H "Authorization: Bearer <TOKEN>"

# Step 3: 大盘今日表现
curl -s "http://localhost:8001/api/v1/trading/market/overview"

# Step 4: 相关新闻（用于归因）
curl -s "http://localhost:8001/api/v1/news/digest?hours_ago=24"
```

### 3.2 复盘结构（按阶段调整）

#### 适应期（Day 1-3）：观察式复盘

用户没有持仓，复盘重点是「今天看到了什么、学到了什么」：

1. **今日市场回顾**：大盘怎么走的、涨跌多少
2. **新闻回顾**：早上那条新闻后来市场怎么反应的？
3. **知识点巩固**：早上教的那个概念，在今天的行情中你看到了吗？
4. **明天预告**：明天我们看什么（引出好奇心）
5. **风险提示**

#### 有持仓阶段（Day 4+）：实战式复盘

1. **今日结果**：涨跌/盈亏 + 与恒生指数对比
2. **原因分析**：市场原因/个股原因/新闻影响
3. **决策反思**：用户做对了什么/可改进什么
4. **知识点回顾**：从今日事件带出知识点
5. **写入日记 + 明日预告**
6. **风险提示**：结尾必须加「以上仅供学习，不构成投资建议」

### 3.3 发群与记录

- **直接输出回复内容**，框架（announce 模式）会自动投递到投资群，**不要调用 message 工具**
- **必须添加风险提示**：消息结尾加「以上仅供学习，不构成投资建议」
- 写入执行记录：`evening_review_done: true`
- **Day 4+ 有持仓时**把复盘内容写入 TradeJournal 日记：
```bash
curl -s -X POST "http://localhost:8001/api/v1/journal/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "account_id": 21,
    "entry_date": "今天",
    "content": "复盘内容..."
  }'
```

---

## 4. 盘中异常监控（Heartbeat 每 30 分钟，09:30-16:00）

**此逻辑由 Heartbeat 在港股交易时间内每 30 分钟自动触发。**

用途：检查是否有需要主动提醒用户的异常情况。**大多数时候回复 `HEARTBEAT_OK` 即可。**

### 4.1 快速健康检查

```bash
curl -s "http://localhost:8001/api/v1/trading/market/overview" | head -c 100
```
若 API 不可用，日志记 `data_layer_ready: false`，回复 `HEARTBEAT_OK`。

### 4.2 异常检测（有持仓时）

若用户有持仓（Day 4+），获取持仓行情并检查：

| 优先级 | 触发条件 | 动作 |
|--------|---------|------|
| 🔴 高 | 持仓跌超止损线 / 持仓有重大新闻 | 用 message 工具**推送一条**提醒 |
| 🟡 中 | 持仓涨超 5% | 可推送 |
| 🟢 低 | 收盘前 30 分钟（15:30 后）| 可推送收盘提醒 |

**限制**：盘中推送每天不超过 3 条。

### 4.3 适应期（Day 1-3）

无持仓，盘中监控仅在市场大事件（如 ^HSI 暴跌 >3%）时推送。其他情况回复 `HEARTBEAT_OK`。

### 4.4 无异常时

回复 `HEARTBEAT_OK`，不发群。

---

- 上述路径中的日期一律用**上海时区**的「今天」
- 21 天阶段节奏、毕业逻辑见 **skills/tradejournal-coach/SKILL.md**
- 认证 Token 从本文件第 0 节获取
