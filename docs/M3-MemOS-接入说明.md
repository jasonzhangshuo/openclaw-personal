# M3 MemOS 接入说明

## 当前插件兼容谁？

OpenClaw 的 `memos-cloud-openclaw-plugin` 调用的是 **MemOS Cloud** 的 API：

- 召回：`/search/memory`
- 写入：`/add/message`
- 认证：`Authorization: Token <MEMOS_API_KEY>`

**自建 MemOS**（GitHub MemTensor/MemOS + Docker）提供的是 **/product/search**、**/product/add**，路径和请求格式与上面不同，**当前插件不能直接对接自建**。要用记忆功能，需用 MemOS Cloud 或等官方出自建兼容层。

---

## 方案一：用 MemOS Cloud（推荐，无需再装）

**不需要 Docker，不需要本地再装任何东西。**

1. 打开 [MemOS 控制台](https://memos-dashboard.openmem.net/cn/quickstart/) 注册/登录。
2. 进入 **API Keys**：<https://memos-dashboard.openmem.net/cn/apikeys/>，新建并复制 API Key。
3. 在项目根目录 `.env` 里填写：
   ```bash
   MEMOS_API_KEY=你的API_Key
   MEMOS_USER_ID=openclaw-main
   ```
   （`MEMOS_USER_ID` 可自定，建议稳定唯一，如 `dada-main`。）
4. 同步并重启：
   ```bash
   cp .env .openclaw/state/.env && openclaw gateway restart
   ```
5. 在飞书群或 Chat 里正常对话，插件会在会话前召回记忆、会话后写入记忆。

---

## 方案二：自建 MemOS（Docker）

自建可以跑起来，但**当前 OpenClaw 插件不能连自建**（接口不兼容）。若你仍想先在本机起一套 MemOS（例如做开发、调试或等后续兼容），可按下面做。

### 还需要安装/准备什么

- **Docker**：已安装 ✅  
- **Docker Compose**：随 Docker Desktop 提供，无需单独装  
- **MemOS 所需环境变量**：自建 MemOS 需要 LLM/Embedding 等配置（如 `OPENAI_API_KEY` 或百炼 Key、Neo4j、Qdrant 在 docker-compose 里已包含）

### 一键 clone 并启动（仅启动服务，插件暂不可用）

在项目外任意目录执行：

```bash
git clone https://github.com/MemTensor/MemOS.git
cd MemOS
cp docker/.env.example .env
# 编辑 .env，至少填 OPENAI_API_KEY 或按文档填百炼等
cd docker
docker compose up --build
```

服务起来后 API 在 `http://localhost:8000`，文档在 `http://localhost:8000/docs`。  
**注意**：当前 OpenClaw 插件不会连这个自建实例，需等 MemOS 提供 openmem 兼容 API 或插件支持 /product 接口。

---

## 小结

| 方式           | 是否需要 Docker | 插件是否可用 | 你要做的                     |
|----------------|------------------|-------------|------------------------------|
| **MemOS Cloud** | 否               | 是          | 注册 → 拿 Key → 填 .env → 重启 |
| **自建 MemOS**  | 是               | 否（接口不同） | clone + 填 .env + docker compose up |

**建议**：先按方案一用 MemOS Cloud 把 M3 跑通；若以后官方出自建兼容或插件支持 /product，再切到自建。
