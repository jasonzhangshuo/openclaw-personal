# Healthchecks 本地部署

用于监控本地 cron / 定时任务：任务按时发 HTTP ping，超时未收到则告警，面板上一目了然。

## 已完成的步骤

- 已用 Docker Compose 启动：PostgreSQL 16 + Healthchecks 官方镜像
- 服务地址：**http://localhost:8000**
- 数据卷：`healthchecks_db-data`（数据库持久化）

## 你需要做的一步：创建管理员账号

在终端执行（按提示输入用户名、邮箱、密码）：

```bash
cd /Users/zhangshuo/openclawxitong/healthchecks
docker compose run --rm web /opt/healthchecks/manage.py createsuperuser
```

完成后用该账号登录 http://localhost:8000 。

## 常用命令

| 操作           | 命令 |
|----------------|------|
| 启动           | `docker compose up -d` |
| 停止           | `docker compose down` |
| 查看状态       | `docker compose ps` |
| 查看 web 日志  | `docker compose logs -f web` |

## 在 cron 里发 ping

1. 登录后新建一个 Check，设置 Period（期望执行间隔）和 Grace（超时宽限时间）。
2. 复制该 Check 的 ping URL（形如 `http://localhost:8000/ping/<uuid>`）。
3. 在 crontab 或脚本里发请求即可：

```bash
# 成功时
curl -fsS -m 10 http://localhost:8000/ping/<你的uuid>

# 或：脚本开始时 ping 一次，失败时带 /fail
curl -fsS -m 10 http://localhost:8000/ping/<uuid> && /path/to/script.sh || curl -fsS -m 10 http://localhost:8000/ping/<uuid>/fail
```

配置在 `healthchecks/.env`，如需改端口或加邮件告警可编辑该文件后 `docker compose up -d` 重启。

---

## OpenClaw 发群脚本（已停用）

原 **lifecoach-heartbeat-send** 与 **foodcoach-heartbeat-send** 两个 120 分钟兜底脚本已停用并移除；heartbeat 发群由 Gateway 的 message 工具或 `heartbeat.target: "feishu"` 完成。若曾在 Healthchecks 中建过这两个 Check，可保留或删除均可。

---

## 后续可复用：用 Django 直接创建 Check 并写入 plist（无需 API Key）

当需要**自动**为 OpenClaw 或其他任务创建 Healthchecks Check 并写进配置时，可用下面方式，不依赖用户在网页里复制 API Key 或 Ping URL。

### 1. 在容器内用 Django shell 创建 Check，得到 ping URL

在 `healthchecks/` 目录下执行（需先 `docker compose up -d`）：

```bash
cd /Users/zhangshuo/openclawxitong/healthchecks
docker compose exec web python /opt/healthchecks/manage.py shell -c "
from hc.api.models import Check
from hc.accounts.models import Project
from datetime import timedelta as td
from django.conf import settings
p = Project.objects.first()
if not p:
    print('NO_PROJECT')
    exit(1)
# 按需创建 Check：name、timeout(秒)、grace(秒)
# 示例：lifecoach/foodcoach 兜底脚本已停用，以下仅作创建 Check 的参考
c1 = Check(project=p, name='example-check', timeout=td(seconds=600), grace=td(seconds=300))
c1.save()
url1 = settings.PING_ENDPOINT + str(c1.code)
print('PING_URL=' + url1)
"
```

从输出里取出 `PING_URL=` 的值，填进你的任务脚本或 plist 的环境变量即可。

### 2. 说明

- **为什么用 Django shell 而不是 API**：自建实例下用 `docker compose exec web ... manage.py shell` 不需要用户去后台拿 API Key，Agent 或脚本可直接在容器内创建 Check 并拿到 `code`（UUID），拼出 `PING_ENDPOINT + code` 即 ping URL。
- **新增其他定时任务**：在 shell 里增加 `Check(project=p, name='任务名', timeout=td(seconds=...), grace=td(seconds=...)).save()`，并在对应脚本里读环境变量发 ping；plist 里增加同名环境变量并填入该 Check 的 ping URL。
