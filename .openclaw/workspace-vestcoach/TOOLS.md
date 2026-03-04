# TOOLS.md - Vest Coach 数据源配置

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

---

## 📊 数据层状态（关键）

**当前状态：✅ 数据 API 已就绪**（2026-02-27 测试通过）

TradeJournal 服务运行在 `http://localhost:8001`，以下 API 均可直接调用。

### API 配置

| 配置项 | 值 |
|--------|-----|
| **Base URL** | `http://localhost:8001/api/v1` |
| **认证方式** | Bearer Token (JWT) |
| **测试账号** | `vestcoach_test` / `test123456` |
| **测试账户 ID** | 21 |

### 需要的数据 API

| 数据 | API 路径 | 用途 | 状态 |
|------|---------|------|------|
| 用户账户状态 | `GET /trading/accounts/{id}` | 现金、持仓、盈亏 | ✅ |
| 用户订单 | `GET /trading/orders/{account_id}?date=YYYY-MM-DD` | 每日操作记录 | ✅ |
| 用户日记记录 | `GET /journal/entries/{account_id}?date_from=&date_to=` | 成长轨迹 | ✅ |
| 写入日记 | `POST /journal/entries` | 记录复盘内容 | ✅ |
| 大盘指数 | `GET /trading/market/overview` | 港股/美股/A股指数 | ✅ |
| 财经新闻摘要 | `GET /news/digest?hours_ago=24` | 市场大事 | ✅ |
| 持仓个股行情 | `GET /trading/stocks/{symbol}/quote` | 盘前涨跌 | ✅ |
| 持仓基本面 | `GET /trading/stocks/{symbol}/fundamentals` | 估值参考 | ✅ |
| 技术指标 | `GET /indicators/{symbol}/summary` | MA/RSI/MACD 信号 | ✅ |

---

## 🔧 API 调用示例

### 获取账户信息

```bash
curl -s "http://localhost:8001/api/v1/trading/accounts/21" \
  -H "Authorization: Bearer <TOKEN>"
```

返回：
```json
{
  "id": 21,
  "name": "vestcoach_测试账户",
  "cash": 94765.0,
  "total_value": 100000.0,
  "positions": [{
    "symbol": "0700.HK",
    "quantity": 10,
    "avg_cost": 523.5,
    "current_price": 523.5,
    "market_value": 5235.0,
    "profit_loss": 0.0
  }]
}
```

### 获取大盘指数

```bash
curl -s "http://localhost:8001/api/v1/trading/market/overview"
```

返回港股、美股、A股主要指数。

### 获取个股行情

```bash
# 港股
curl -s "http://localhost:8001/api/v1/trading/stocks/0700.HK/quote"

# 美股
curl -s "http://localhost:8001/api/v1/trading/stocks/AAPL/quote"

# A股
curl -s "http://localhost:8001/api/v1/trading/stocks/600519.SS/quote"
```

### 获取技术指标信号

```bash
curl -s "http://localhost:8001/api/v1/indicators/0700.HK/summary"
```

返回 MA、RSI、MACD、布林带信号及整体建议。

### 获取新闻摘要

```bash
curl -s "http://localhost:8001/api/v1/news/digest?hours_ago=24&limit_per_source=3"
```

### 下单交易

```bash
curl -s -X POST "http://localhost:8001/api/v1/trading/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"account_id":21,"symbol":"0700.HK","side":"buy","quantity":10}'
```

### 写入日记

```bash
curl -s -X POST "http://localhost:8001/api/v1/journal/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "account_id": 21,
    "entry_date": "2026-02-27",
    "content": "今日复盘内容..."
  }'
```

---

## 📁 本地数据路径

### Heartbeat 日志

```
/Users/zhangshuo/openclawxitong/.openclaw/workspace-vestcoach/data/heartbeat_log/YYYY-MM-DD.json
```

记录每天的早上开场与收盘复盘是否已执行。

### 用户成长进度

```
/Users/zhangshuo/openclawxitong/.openclaw/workspace-vestcoach/MEMORY.md
```

记录用户的知识点进度、投资偏好、阶段位置。

---

## 🌍 市场配置（支持港股为主）

| 市场 | 主要指数 | 交易时间（北京时间） |
|------|---------|---------------------|
| **港股** | ^HSI (恒生指数)、0700.HK (腾讯)、9988.HK (阿里) | 09:30 - 16:00 |
| 美股 | SPY、QQQ、^GSPC、^IXIC | 21:30 - 次日 04:00（夏） |
| A股 | 000001.SS、399001.SZ | 09:30 - 15:00 |

### 常用股票代码

| 代码 | 名称 | 市场 |
|------|------|------|
| 0700.HK | 腾讯 | 港股 |
| 9988.HK | 阿里 | 港股 |
| 1810.HK | 小米 | 港股 |
| AAPL | 苹果 | 美股 |
| MSFT | 微软 | 美股 |
| NVDA | 英伟达 | 美股 |
| TSLA | 特斯拉 | 美股 |
| 600519.SS | 贵州茅台 | A股 |

---

## 📌 时区与 heartbeat 时间

- **时区**：Asia/Shanghai
- **早上开场**：08:30 - 09:30（港股开盘前）
- **收盘复盘**：16:30 - 17:30（港股收盘后）
- **注意**：不再使用美股时间，改为以港股为主

---

## 🔧 ClawHub Skill 管理

搜索、安装、更新 skill 时，直接用 exec 跑 clawhub CLI，**不要用 web_search / web_fetch**。

```bash
# 搜索 skill
clawhub search <关键词>

# 安装（必须 cd 到本 workspace 目录）
cd /Users/zhangshuo/openclawxitong/.openclaw/workspace-vestcoach && clawhub install <slug>

# 列出已装的
cd /Users/zhangshuo/openclawxitong/.openclaw/workspace-vestcoach && clawhub list

# 更新所有
cd /Users/zhangshuo/openclawxitong/.openclaw/workspace-vestcoach && clawhub update
```

安装后新 skill 在 `skills/` 目录下，下次对话自动生效。

---

Add whatever helps you do your job. This is your cheat sheet.
