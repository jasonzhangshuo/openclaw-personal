# VestCoach 开发进度日志

**最后更新**: 2026-02-27 19:00
**作者**: jason + Party Mode

---

## 📋 当前状态

| 项目 | 状态 |
|------|------|
| 21 天启动 | ✅ Day 1 定于 2026-02-28 |
| 早上开场 | ⏰ 明天 08:30 自动触发 |
| 收盘复盘 | ⏰ 明天 16:30 自动触发 |

---

## 🔧 技术架构

### 组件

| 组件 | 路径 | 说明 |
|------|------|------|
| TradeJournal 服务 | `/Users/zhangshuo/TradeJournal/` | Python FastAPI 后端，端口 8001 |
| VestCoach Agent | `.openclaw/workspace-vestcoach/` | OpenClaw Agent |
| 飞书群 | `oc_f08d41bfb84e07670be80e0c8f488558` | 投资群 |

### 调度机制（2026-02-27 更新）

| 场景 | 方式 | 配置 |
|------|------|------|
| 早上 08:30 开盘 | **Cron** | `0 30 8 * * *` |
| 下午 16:30 收盘 | **Cron** | `0 30 16 * * *` |
| 盘中异常检测 | **Heartbeat** | `every: 30m`, activeHours: 09:30-16:00 |

### 关键文件

| 文件 | 用途 |
|------|------|
| `.openclaw/workspace-vestcoach/HEARTBEAT.md` | Heartbeat 逻辑、API 调用 |
| `.openclaw/workspace-vestcoach/MEMORY.md` | 用户进度、知识点、习惯 |
| `.openclaw/workspace-vestcoach/SOUL.md` | 人设、三大场景 |
| `.openclaw/workspace-vestcoach/skills/tradejournal-coach/SKILL.md` | 21 天阶段节奏 |
| `TradeJournal/src/backend/routes/xueqiu.py` | 雪球行情 API |

---

## ✅ 已完成功能

### 1. TradeJournal 服务
- [x] 服务在线 (localhost:8001)
- [x] 港股支持 (0700.HK 腾讯、09988.HK 阿里)
- [x] 用户注册 + 账户创建 (测试账户 account_id=21)
- [x] 买入交易测试

### 2. API 接口
- [x] `/api/v1/trading/accounts/{id}` - 账户状态
- [x] `/api/v1/trading/orders/{account_id}` - 订单
- [x] `/api/v1/trading/market/overview` - 美股大盘
- [x] `/api/v1/news/digest` - 中文新闻摘要（6个源）
- [x] `/api/v1/xueqiu/quote/{symbols}` - 雪球实时行情
- [x] `/api/v1/xueqiu/hk/overview` - 港股热门行情
- [x] `/api/v1/indicators/{symbol}/summary` - 技术指标

### 3. Heartbeat 流程
- [x] 早上开场 (08:30-09:30)
- [x] 收盘复盘 (16:30-17:30)
- [x] 消息发到飞书群
- [x] 日志记录

### 4. 消息优化
- [x] RSI 描述规范（RSI > 70 超买，< 30 超卖，30-70 中等）
- [x] 风险提示（必加「以上仅供学习，不构成投资建议」）

### 5. 新闻源修复
- [x] 替换失效 RSS 源
- [x] 新增 6 个可用源（含中文 feedx.net WSJ）
- [x] DeepSeek 中文摘要

### 6. 雪球行情接入
- [x] pysnowball 安装
- [x] `/xueqiu/quote/{symbols}` API
- [x] `/xueqiu/hk/overview` API

---

## 🔴 待完成

### 高优先级
1. **Day 1 启动** - 明天 2026-02-28 早上 08:30
2. **真实用户账户** - 当前用测试账户 21，需绑定真实用户

### 中优先级
1. **毕业逻辑** - Day 21 后的行为
2. **盘中推送** - 跌超止损线等异常推送

### 低优先级
1. **用户偏好确认** - MEMORY.md 中的投资偏好待问用户
2. **知识点/习惯追踪** - 每天更新 MEMORY.md

---

## 📝 21 天阶段（MEMORY.md）

| 阶段 | 天数 | 状态 |
|------|------|------|
| 适应期 | Day 1-3 | 🔄 明天开始 |
| 观察期 | Day 4-7 | ⏳ |
| 实践期 | Day 8-14 | ⏳ |
| 独立期 | Day 15-21 | ⏳ |

---

## 🔑 启动命令

```bash
# 进入项目目录
cd /Users/zhangshuo/openclawxitong

# 设置环境变量
export OPENCLAW_CONFIG_PATH=$(pwd)/.openclaw/config
export OPENCLAW_STATE_DIR=$(pwd)/.openclaw/state

# 手动触发测试
openclaw agent --agent vestcoach -m "测试消息" --timeout 120

# 查看 heartbeat 日志
cat .openclaw/workspace-vestcoach/data/heartbeat_log/2026-02-27.json
```

---

## 📅 后续计划

### 2026-02-28 (Day 1)
- [ ] 早上 08:30 收到 VestCoach 开场消息
- [ ] 回答师傅问题，完成用户画像
- [ ] 下午 16:30 收到复盘消息

### 2026-03-01 ~ 2026-03-06 (Day 2-6)
- 适应期：了解市场、账户、个股
- 每天早/晚 heartbeat 自动运行

### 2026-03-07 ~ 2026-03-13 (Day 7-13)
- 观察期 + 实践期：可能开始实盘

### 2026-03-14 ~ 2026-03-20 (Day 14-20)
- 独立期：减少干预

### 2026-03-21 (Day 21)
- 毕业！

---

*持续更新...*
