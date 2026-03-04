# OpenClaw Docker 部署（与现有实例隔离）

## 目标

- 保持你工作机已有 OpenClaw 实例不受影响。
- 新实例独立端口、独立 state、独立群路由。

## 1. 本机准备

1. 复制环境变量模板：
   - `cp .env.docker.example .env.docker`
2. 填写 `.env.docker`（至少模型 key + 飞书 key）。
3. 准备 Docker 配置文件（该文件默认不进 Git）：
   - 若你有本机配置备份（例如 `.openclaw/config.local`），先执行：
   - `node scripts/prepare-docker-config.js --input .openclaw/config.local --output .openclaw/config`
   - 该脚本会把本机绝对路径替换为容器路径 `/app`。

## 2. 先迁移 personalOS 数据到单仓目录

```bash
node scripts/migrate-personalos-into-workspace.js
```

默认迁移到：

- `.openclaw/workspace-lifecoach/data/personalos/`

## 3. 工作机启动 Docker

```bash
docker compose up -d --build
```

Gateway 暴露端口：

- 宿主机 `18790` -> 容器 `18789`

## 4. 测试群灰度（推荐）

1. 先在 `.openclaw/config` 里把绑定群改成测试群。
2. 在测试群验证：
   - 收消息 / 回消息
   - 至少 1 条 cron 正常
3. 通过后再切正式群，并关闭旧实例对应绑定，避免双发。

## 5. 常用命令

```bash
docker compose logs -f openclaw
docker compose restart openclaw
docker compose down
```

## 6. 关键注意

- 不要把 `.openclaw/config`、`.openclaw/state`、`.env.docker` 提交到 Git。
- 若工作机仓库路径不是 `/Users/zhangshuo/openclawxitong`，请确保你使用的是该仓库内的配置文件，不要复用本机绝对路径配置。
