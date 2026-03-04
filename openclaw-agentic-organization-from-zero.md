# 归档 - Agentic Organization 蓝图（OpenClaw + 飞书 + MemOS）

> 状态：历史蓝图文档（归档）。
> 当前事实请优先阅读 `NOW.md`。
> 决策历史记录在 `DECISIONS.md`。
> 执行流水记录在 `CHANGELOG-RUNNING.md`。

> 文档定位：顶层蓝图（Blueprint）
> 版本：v1
> 适用范围：从 0 到可运行的单 Gateway 多 Agent 体系

## 1. 蓝图目标与边界

### 1.1 目标

建立一套可持续演进的 Agentic 工作底座：

- `1 个 OpenClaw Gateway`
- `1 个飞书机器人账号 + 多个飞书群`
- `bindings` 将不同群路由到不同 Agent
- 不同 Agent 使用不同 LLM（成本/能力分层）
- MemOS 提供外置记忆，支持“可控共享 + 成本优化”

### 1.2 非目标（当前阶段不做）

- 不做多 Gateway 高可用集群
- 不做自动化全量评测平台
- 不做复杂多租户权限系统

---

## 2. 核心设计原则

1. **先稳定，后扩展**：单 Agent 单群跑通，再扩多 Agent，再接记忆共享。
2. **配置即系统**：`openclaw.json` 视为工程资产，版本化管理。
3. **人类负责最终决策**：Agent 输出必须可审、可回滚、可追溯（与 agentic engineering 的“人做架构与评审”一致）。
4. **成本可控优先**：按任务选模型，记忆按需召回，避免全量上下文。
5. **边界可解释**：任何共享策略都能解释“为什么共享、共享到哪一层”。
6. **流程可落地**：底座需支持“规划 → 执行 → 审查 → 测试”的闭环。

---

## 3. 架构总览

- **交互层**：飞书群（脑暴/写作/Coding/资讯）
- **编排层**：OpenClaw（bindings + agents + channels）
- **能力层**：不同 Agent 对应不同模型
- **记忆层**：MemOS（add/search，按参数控制隔离与共享）
- **治理层**：Git 版本管理 + 变更流程 + 验收清单 + 回滚策略

---

## 4. 里程碑路线图（强制顺序）

## M0：环境与基线确认

### 目标
确认本机具备可实施条件。

### 必做命令

```bash
openclaw --version
openclaw gateway status
openclaw plugins install @openclaw/feishu
openclaw plugins install github:MemTensor/MemOS-Cloud-OpenClaw-Plugin
```

### 通过标准

- OpenClaw 版本以官方安装文档/Releases 当前推荐为准，并记录本次实施实际版本号
- 两个插件安装成功
- 基线版本和命令输出已记录

## M1：单 Agent + 单群

### 目标
先证明“消息链路 + 路由 + 会话”最小闭环可用。

### 实施要点

- 只启用 `main` Agent
- 只绑定 1 个测试群
- 群内必须 `@` 机器人
- MemOS 暂不启用（或 `enabled: false`）

### 通过标准

- 收发消息稳定
- 日志能看到正确路由命中
- 配对/权限流程正常
- 同一群内多轮对话上下文正确，无错绑其他会话

## M2：多 Agent + 多群

### 目标
建立“按职能分工”的多 Agent 协作架构。

### 实施要点

- 按群绑定：`brainstorm` / `writer` / `coding` / `main`
- `bindings` 保证“具体规则在前，兜底在后”
- 每个 Agent 独立 `workspace`
- 每个 Agent 分配对应模型

### 通过标准

- 每个群命中正确 `agentId`
- 群间会话不串
- 兜底路由生效

## M3：接入 MemOS（隔离到共享）

### 目标
在不破坏稳定性的前提下引入长期记忆与 token 优化。

### 实施要点

- 在 `~/.openclaw/.env` 配置 `MEMOS_API_KEY`、`MEMOS_USER_ID`
- 初始保守参数：
  - `captureStrategy: "last_turn"`
  - `memoryLimitNumber: 4~6`
  - `preferenceLimitNumber: 2~4`
  - `recallGlobal: false`
- 稳定后再灰度 `recallGlobal: true`

### 通过标准

- 无明显“串味”
- 召回命中可观察（日志可见）
- token 与响应质量达到预期改进

---

## 5. 治理与变更流程（总则）

1. `openclaw.json` 进入 Git，但密钥只放 `.env`。
2. 每次变更必须记录：改了什么、为什么改、影响哪个 Agent/群。
3. 变更前保留配置快照；异常时优先回滚配置。
4. 任何路由或记忆策略变更后，必须执行一次冒烟清单。

### 最小冒烟清单

- 脑暴群发消息：命中 `brainstorm`
- Coding 群发消息：命中 `coding`
- 未绑定群或 DM：命中 `main`

---

## 6. 评估框架（总则）

先定义最小可观测指标（后续再自动化）：

- **路由正确率**：是否命中预期 Agent
- **响应稳定性**：错误率、超时率
- **质量可用性**：是否跑题、是否可执行
- **成本趋势**：主要任务 token 变化

建议每周抽样复盘一次，形成“可比较”的迭代记录。

---

## 7. 文档分层地图（后续衍生）

当前文件是总蓝图，后续拆分建议如下：

以上路径均相对于本仓库根目录（如 `gptcodex`）。

1. `docs/openclaw-implementation-runbook.md`
- 面向执行：从安装到联调的逐步命令手册。

2. `docs/openclaw-routing-and-agents.md`
- 面向配置：`agents`、`bindings`、群路由策略与反例。

3. `docs/openclaw-memory-strategy-memos.md`
- 面向记忆治理：MemOS 参数、隔离/共享策略、回滚规则。

4. `docs/openclaw-operations-checklist.md`
- 面向运维：日常巡检、故障排查、上线变更与回滚流程。

5. `docs/openclaw-evaluation-metrics.md`
- 面向评估：SLO、样本抽检、质量与成本看板规范。

---

## 8. 关键参考

- OpenClaw installer 文档：<https://github.com/openclaw/openclaw/blob/main/docs/install/installer.md>
- OpenClaw Feishu 文档：<https://github.com/openclaw/openclaw/blob/main/docs/channels/feishu.md>
- OpenClaw 配置参考：<https://github.com/openclaw/openclaw/blob/main/docs/gateway/configuration-reference.md>
- MemOS 插件：<https://github.com/MemTensor/MemOS-Cloud-OpenClaw-Plugin>
- OpenClaw Releases：<https://github.com/openclaw/openclaw/releases>
