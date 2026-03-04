# M0 环境与基线记录

> 对应蓝图：`openclaw-agentic-organization-from-zero.md` → M0  
> 本文档记录本次实施的版本与命令输出，便于回滚与复现。

## 1. 实施时间

- **记录时间**：2026-02-18（UTC 03:32）
- **升级记录**：2026-02-18 通过官方安装脚本升级至 2026.2.17
- **执行方式**：命令行（部分由 Cursor 代执行）

## 2. 版本基线

| 组件 | 版本/来源 | 说明 |
|------|-----------|------|
| OpenClaw CLI | **2026.2.17** | 经 `curl … openclaw.ai/install.sh \| bash` 升级（当前脚本拉取 latest = 2026.2.17） |
| 飞书插件 @openclaw/feishu | **stock**（随 OpenClaw） | 使用自带插件，无需 `plugins install` |
| MemOS Cloud OpenClaw Plugin | **0.1.0**（本地安装） | 从仓库克隆后 `openclaw plugins install <path>` 安装 |

## 3. 必做命令与输出

### 3.1 版本与 Gateway 状态

```bash
openclaw --version
# 输出：2026.2.17（升级后）

openclaw gateway status
# 项目环境（source .env.openclaw）下已就绪：
#   Runtime: running, RPC probe: ok, Listening: 127.0.0.1:18789
#   Config (cli): $OPENCLAW_HOME/config → 项目/.openclaw/config
```

### 3.2 插件安装（实际执行）

- **飞书**：未执行 `openclaw plugins install @openclaw/feishu`，使用 **stock** 自带 feishu（在配置中启用即可）。
- **MemOS**：官方文档的 `github:MemTensor/MemOS-Cloud-OpenClaw-Plugin` 在当前 OpenClaw 下会报错 `unsupported npm spec: protocol specs are not allowed`，改为**本地路径安装**：

```bash
# 克隆（项目内或任意目录）
git clone --depth 1 https://github.com/MemTensor/MemOS-Cloud-OpenClaw-Plugin.git .plugins/MemOS-Cloud-OpenClaw-Plugin

# 安装到 ~/.openclaw/extensions
openclaw plugins install /path/to/MemOS-Cloud-OpenClaw-Plugin
# 本机实际路径：openclaw plugins install /Users/zhangshuo/openclawxitong/.plugins/MemOS-Cloud-OpenClaw-Plugin
```

安装后输出含：`Installed plugin: memos-cloud-openclaw-plugin`，并提示在 `~/.openclaw/.env` 配置 `MEMOS_API_KEY`（M3 再配）。

### 3.3 项目环境与 Gateway（本次补做）

- **项目配置**：`openclawxitong/.openclaw/config`（由 `OPENCLAW_CONFIG_PATH` 指定），含 `gateway.mode: "local"`，否则 Gateway 会拒绝启动。
- **MemOS 在项目环境**：在已 `source .env.openclaw` 的终端执行  
  `openclaw plugins install .plugins/MemOS-Cloud-OpenClaw-Plugin`，插件安装到 `$OPENCLAW_HOME/state/extensions`。
- **Gateway**：`openclaw gateway install` 后 `openclaw gateway restart`；若曾报 `Gateway start blocked`，在 config 中增加 `"gateway": { "mode": "local" }` 再重启。

## 4. M0 验收结论

- [x] OpenClaw 可执行，版本已记录
- [x] 飞书插件：可用（stock）
- [x] MemOS 插件：已安装并 loaded（默认环境 ~/.openclaw 与项目环境 source 后均有）
- [x] Gateway 可用：项目环境下 Runtime running、RPC probe ok、127.0.0.1:18789 监听
- [x] 配置/基线：项目内使用 `.openclaw/config`，版本与命令输出已记录

## 5. 基础配置（可选：Dashboard Chat 可用）

- **LLM 模型**：config 中 agent 的 `model`（如 `zai/glm-5`）需在 `openclaw models list` 中可用；未配则需先做模型认证。
- **1008 / device token mismatch**：Dashboard 与 Chat 需携带与 config 一致的 gateway token。获取：`openclaw config get gateway.auth.token`，在 Dashboard 设置中粘贴。若仍报 1008，执行 `openclaw gateway install --force` 与 `openclaw gateway restart` 后，重新获取 token 再粘贴。

## 6. 后续建议

- M1：在 config 中填入飞书 appId/appSecret 与真实群 ID，配对后验证收发。
- MemOS 的 `MEMOS_API_KEY` 在 M3 接入记忆时再配置。
- 若将来 OpenClaw 支持 `github:` 协议，可改用：  
  `openclaw plugins install github:MemTensor/MemOS-Cloud-OpenClaw-Plugin`。
