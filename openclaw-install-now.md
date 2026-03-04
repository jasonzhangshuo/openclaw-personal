# OpenClaw 先安装就好（15-30 分钟）

> 目标：先把 OpenClaw + 飞书跑通（单 Agent、单群）
> 暂时不做：多 Agent 路由、MemOS 共享、评估体系

## 1. 安装 OpenClaw

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash
openclaw --version
```

## 2. 安装飞书插件

```bash
openclaw plugins install @openclaw/feishu
```

## 3. 配飞书（推荐向导）

```bash
openclaw channels add
```

按提示选择 `Feishu`，填：
- `App ID`（`cli_xxx`）
- `App Secret`

## 4. 最小配置（单 Agent + 单群）

编辑 `~/.openclaw/openclaw.json`，至少确保有类似配置：

```json5
{
  agents: {
    list: [
      {
        id: "main",
        default: true,
        workspace: "~/.openclaw/workspace-main",
        model: "zai/glm-5"
      }
    ]
  },
  channels: {
    feishu: {
      enabled: true,
      dmPolicy: "pairing",
      groupPolicy: "open",
      groups: {
        "oc_your_test_group_id": { requireMention: true }
      }
    }
  },
  bindings: [
    {
      agentId: "main",
      match: {
        channel: "feishu",
        peer: { kind: "group", id: "oc_your_test_group_id" }
      }
    }
  ]
}
```

## 5. 启动并验证

```bash
openclaw gateway restart
openclaw gateway status
openclaw logs --follow
```

在测试群里 `@` 机器人发一句话。
若出现配对码：

```bash
openclaw pairing list feishu
openclaw pairing approve feishu <CODE>
```

## 6. 完成判定（今天只看这 3 条）

- 机器人能稳定收发消息
- 日志能看到群消息进入 `main` Agent
- 连续两三轮对话上下文正常

---

## 下一步（等你跑通再做）

1. 扩成多 Agent 多群：`docs/openclaw-implementation-runbook.md` 的 M2
2. 再接 MemOS：`docs/openclaw-implementation-runbook.md` 的 M3
