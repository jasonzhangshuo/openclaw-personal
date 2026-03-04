# 在 Cursor 中使用 MemOS MCP

MemOS 记忆管理 MCP 已配置为**全局**使用（所有 Cursor 项目共享同一套记忆）。配置位于 **`~/.cursor/mcp.json`**。

## 1. 安装 / 启用 MCP（当前为全局配置）

1. 编辑 **`~/.cursor/mcp.json`**（用户主目录下），将 `env` 里两处占位符换成你的真实值（若尚未填写）：
   - `MEMOS_API_KEY`：在 [MemOS 控制台](https://memos-docs.openmem.net/cn/mcp_agent/mcp/guide) 新建 API Key 后粘贴。
   - `MEMOS_USER_ID`：建议用邮箱、姓名或固定 ID（如 `cursor-main`），不同设备保持一致。
   - `MEMOS_CHANNEL`：保持 `"MODELSCOPE"` 即可。
2. 完全退出并重新打开 Cursor，使 MCP 配置生效。
3. 在 Cursor 中：**Settings → Tools & MCP**，确认 **memos-api-mcp** 为运行状态，且能看到 `search_memory`、`add_message` 等工具。

若需改回「仅当前项目」：可将 `.cursor/mcp.json.example` 复制为 `.cursor/mcp.json` 并填入密钥，同时从 `~/.cursor/mcp.json` 中删掉 `memos-api-mcp` 条目。

## 2. 如何调用

- **搜索记忆**：AI 在回答前会通过 `search_memory` 用检索词在 MemOS 中查与你当前话题相关的记忆。
- **保存对话**：AI 在回答后会通过 `add_message` 把本轮对话摘要写入 MemOS，供后续检索。

项目已包含规则 `.cursor/rules/memos-mcp.mdc`，在启用 MemOS MCP 后，会引导模型按「先 search_memory → 回答 → add_message」的顺序使用。

## 3. 参考

- [MemOS MCP 使用指南](https://memos-docs.openmem.net/cn/mcp_agent/mcp/guide)（含 Claude Desktop、Cursor、Cline、Chatbox 等客户端的配置说明）。
