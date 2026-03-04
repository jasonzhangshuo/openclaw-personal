# HEARTBEAT_LOG

本目录用于记录 **foodcoach** 每次 heartbeat 的执行结果，便于确认是否每 60 分钟被正确触发、以及执行结论（HEARTBEAT_OK 或已发群）。

- **按日文件**：`YYYY-MM-DD.md`（上海时区「今天」），由 agent 在每次执行 heartbeat 时追加。
- **格式**：每次一行或一小段，包含：时间（上海时区）、结论（`HEARTBEAT_OK` 或 `已发群：简要原因`）。若某小时没有新条目，可能表示该次 heartbeat 未成功执行或未写入（如 Gateway 报错、模型超时等）。
- **发群**：由 Gateway 的 heartbeat 投递（config 中 foodcoach 的 `heartbeat.target: "feishu"` + `to: "oc_群ID"`）或 message 工具完成。原 120 分钟兜底脚本已停用。

---

## 手动执行一次 Heartbeat

若需要**立即跑一次** heartbeat（不等到下一轮 60 分钟）：

1. 在**饮食减重群**（foodcoach 绑定的飞书群）中**先 @ 机器人**（本群已配置为须 @ 才触发，不 @ 则消息不会被处理）。
2. 再发送下面这条消息（把 `Current time` 改成当前时间，上海时区）：

```
Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.
Current time: Tuesday, February 24th, 2026 — 10:00 AM (Asia/Shanghai)
```

**说明**：Gateway 的自动 heartbeat 由服务端注入，无需 @。你手动发这条时**必须 @ 机器人**，foodcoach 才会执行 HEARTBEAT.md 并在本目录当日文件中追加一条记录。

**当前时间格式**：`Weekday, Month DDth, YYYY — HH:MM AM/PM (Asia/Shanghai)`，例如：
- `Tuesday, February 24th, 2026 — 2:30 PM (Asia/Shanghai)`
- `Wednesday, February 25th, 2026 — 9:00 AM (Asia/Shanghai)`
