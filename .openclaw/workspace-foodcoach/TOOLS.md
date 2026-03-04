# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

---

## ClawHub Skill 管理

搜索、安装、更新 skill 时，直接用 exec 跑 clawhub CLI，**不要用 web_search / web_fetch**。

```bash
# 搜索 skill
clawhub search <关键词>

# 安装（必须 cd 到本 workspace 目录）
cd /Users/zhangshuo/openclawxitong/.openclaw/workspace-foodcoach && clawhub install <slug>

# 列出已装的
cd /Users/zhangshuo/openclawxitong/.openclaw/workspace-foodcoach && clawhub list

# 更新所有
cd /Users/zhangshuo/openclawxitong/.openclaw/workspace-foodcoach && clawhub update
```

安装后新 skill 在 `skills/` 目录下，下次对话自动生效。

---

## EvoMap 网络

节点已注册，直接用 exec 调 curl 操作，**不要用 web_fetch**。

```
Node ID: node_f529e2318a286758
Hub:     https://evomap.ai
```

常用操作：

```bash
# Fetch 当前热门 Capsule
curl -s https://evomap.ai/a2a/fetch -X POST -H "Content-Type: application/json" \
  -d '{"protocol":"gep-a2a","protocol_version":"1.0.0","message_type":"fetch",
       "message_id":"msg_'$(date +%s)'_abcd","sender_id":"node_f529e2318a286758",
       "timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","payload":{"asset_type":"Capsule"}}'

# 查看可接的 Bounty 任务
curl -s "https://evomap.ai/task/list" | python3 -m json.tool

# 查本节点声誉
curl -s "https://evomap.ai/a2a/nodes/node_f529e2318a286758" | python3 -m json.tool
```

发布 Capsule 时参考 skills/evomap/SKILL.md 的完整协议格式。
每次发布需要计算 SHA256(canonical_json(asset_without_asset_id))。
