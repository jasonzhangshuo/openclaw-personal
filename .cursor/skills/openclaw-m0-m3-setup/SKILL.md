---
name: openclaw-m0-m3-setup
description: One-command OpenClaw setup for M0–M3 (environment, single Feishu group, multi-agent, MemOS). Prompts for LLM API key in terminal, runs full install and self-test, outputs milestone report. Use when setting up OpenClaw from scratch, onboarding M0/M1/M2/M3, or user asks for "一条命令安装", "引导安装", "M0 报告", or sharing setup to GitHub.
---

# OpenClaw M0–M3 引导安装

## 设计原则

- **你只提供密钥**：在终端运行一条命令后，按提示在**同一终端**输入 LLM API Key（不写文件、不找设置页）。
- **其余全自动**：安装、配置、Gateway、Dashboard 用 token 打开、自检、报告。
- **安全**：API Key 仅在本机终端输入，由脚本写入 `.env`（已加入 .gitignore）。

## 一条命令入口（M0）

在**项目根目录**执行：

```bash
./scripts/openclaw-setup.sh
```

流程：

1. 若未检测到 LLM API Key，脚本会提示：**请粘贴你的 API Key（将保存为 ZAI_API_KEY）**，用户在终端粘贴后回车。
2. 脚本自动：检查/安装 OpenClaw、生成或修补 config（workspace 绝对路径、gateway.mode、token）、同步 .env 到 Gateway 可读位置、安装 MemOS（若存在）、安装并启动 Gateway、用带 token 的 URL 打开 Dashboard。
3. **自检**：Gateway RPC、模型列表。
4. **请你验证**：在浏览器 Chat 页发一条消息，确认有回复。
5. **报告**：生成 `docs/M0-report-YYYYMMDD-HHMM.md`，包含目标、完成项、自检结果、请你验证步骤。

也可通过环境变量传入 Key（非交互）：`ZAI_API_KEY=xxx ./scripts/openclaw-setup.sh`

## M0 会完成的目标

- OpenClaw 可执行、版本记录
- Feishu（stock）与 MemOS 插件可用
- Gateway 运行、RPC 正常、端口监听
- Config 就绪（workspace 绝对路径、gateway.mode、gateway.auth）
- Dashboard 用 token 打开，无 1008
- 至少一个 LLM 可用，Chat 能回复
- 输出 M0 报告到 `docs/M0-report-*.md`

## M1–M3 的用法

- **M1（单群）**：在 `.env` 填写 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_GROUP_ID_MAIN` 后再次运行 `./scripts/openclaw-setup.sh` 或 `./scripts/m0-bootstrap.sh`，脚本会把飞书写入 config。配对与验证见 [references/m1.md](references/m1.md)。
- **M2（多 Agent 多群）**：见 [references/m2.md](references/m2.md)。
- **M3（MemOS）**：见 [references/m3.md](references/m3.md)。

## 脚本与路径

| 文件 | 作用 |
|------|------|
| `scripts/openclaw-setup.sh` | 一条命令入口：提示输入 API Key、执行 M0、自检、输出报告 |
| `scripts/m0-bootstrap.sh` | 无交互 M0 自动化（需已存在 .env 且含 LLM Key） |
| `.env.example` | 模板：M0 必填 LLM Key；M1/M3 选填 |

## 共享到 GitHub

本 Skill 与脚本均在项目内（`.cursor/skills/openclaw-m0-m3-setup/`、`scripts/`）。其他人 clone 后只需：

1. 在项目根执行 `./scripts/openclaw-setup.sh`
2. 按提示在终端输入 LLM API Key
3. 按报告中的「请你验证」在 Chat 发一条消息

无需手改 config、无需找 Dashboard 设置页粘贴 token。
