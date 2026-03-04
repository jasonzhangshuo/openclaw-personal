# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# 周/月复盘不走 heartbeat，只用 cron + isolated 会话：
# 用 openclaw cron add --sessionTarget isolated（或指定 sessionKey）在固定时间触发复盘任务，结果 announce 到本群。

# ---------- 当你在下方添加任务、启用 heartbeat 时，请保留下面这条规则 ----------
# 日志输出：若本次运行发现需要记录的内容（结论、待跟进、发现等），请用 write 工具写入指定目录，不要只发在群里。
# - 目录：/Users/zhangshuo/openclawxitong/.openclaw/workspace-thinking/data/heartbeat_logs/
# - 文件名：YYYY-MM-DD.md（按日期；同日多次运行可追加到同一文件，在文件末尾追加新段落即可）
# - 内容格式自定，建议包含：时间、来源（heartbeat）、简要结论或待办。
