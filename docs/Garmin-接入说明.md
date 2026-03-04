# Garmin Connect 接入说明

> 最后更新：2026-02-22

---

## 一、架构概览

```
佳明手表
  ↓ 自动同步
Garmin Connect（中国版 connect.garmin.cn）
  ↓ python-garminconnect 库
garmin_fetch.py / garmin_check_new.py
  ↓
OpenClaw fitcoach agent
  ↓
飞书 fitcoach 群
```

**两个账号**（同一套邮箱/密码，token 分开缓存）：

| 账号 | 域名 | 当前数据 | Token 缓存 |
|------|------|---------|-----------|
| 中国版（主力） | connect.garmin.cn | 2025.11 至今 | `~/.garth_cn/` |
| 国际版（历史） | connect.garmin.com | 2025.10-11 | `~/.garth/` |

---

## 二、脚本说明

### `scripts/garmin_login.py` / `garmin_login_cn.py`
一次性登录，获取并缓存 token。**需要在自己终端交互式运行**（会要求输入密码和验证码）。
```bash
python3 scripts/garmin_login_cn.py      # 中国版（主力）
python3 scripts/garmin_login.py         # 国际版
```
Token 有效期数月，失效时重新运行即可。

### `scripts/garmin_fetch.py`
手动拉取运动数据，供查询或 fitcoach 工具调用。
```bash
python3 scripts/garmin_fetch.py --days 30 --cn       # 最近 30 天（中国版）
python3 scripts/garmin_fetch.py --days 90 --cn       # 最近 90 天
python3 scripts/garmin_fetch.py --latest --cn        # 最近一次运动
python3 scripts/garmin_fetch.py --stats --cn         # 汇总统计
python3 scripts/garmin_fetch.py --days 30 --cn --json  # 原始 JSON
```

### `scripts/garmin_check_new.py`
检测是否有新活动（对比上次记录的 activity ID）。有新活动时输出格式化摘要并 exit 0，无新活动时 exit 2。状态文件：`~/.garmin_last_activity_id`

### `scripts/garmin_notify.sh`
每小时检测新活动 → 有则触发 fitcoach 分析 → 推送到飞书群。
```bash
bash scripts/garmin_notify.sh    # 手动测试
```

**由 launchd 托管**（非 crontab，Mac 唤醒后会补跑错过的任务）：
```
Label: ai.openclaw.garmin-notify
Plist: ~/Library/LaunchAgents/ai.openclaw.garmin-notify.plist
间隔: 每 3600 秒（1 小时）
```

管理命令：
```bash
launchctl list | grep garmin                          # 查看状态
launchctl start ai.openclaw.garmin-notify             # 立即触发一次
launchctl unload ~/Library/LaunchAgents/ai.openclaw.garmin-notify.plist  # 停用
launchctl load   ~/Library/LaunchAgents/ai.openclaw.garmin-notify.plist  # 启用
```

**日志**：
```bash
tail -f .openclaw/state/logs/garmin_notify.log          # 推送记录
tail -f .openclaw/state/logs/garmin_notify_launchd.log  # launchd stdout
tail -f .openclaw/state/logs/garmin_notify_launchd.err.log  # launchd stderr
```

### `scripts/garmin_weekly_push.sh`
每周一 07:30 拉取最近 7 天 Garmin 数据 → fitcoach 生成周报 → 推送到飞书群。
```bash
bash scripts/garmin_weekly_push.sh    # 手动测试
```

**由 launchd 托管**（Mac 唤醒后会补跑错过的任务）：
```
Label: ai.openclaw.garmin-weekly
Plist: ~/Library/LaunchAgents/ai.openclaw.garmin-weekly.plist
时间: 每周一 07:30
```

管理命令：
```bash
launchctl list | grep garmin                          # 查看状态
launchctl start ai.openclaw.garmin-weekly             # 立即触发一次
launchctl unload ~/Library/LaunchAgents/ai.openclaw.garmin-weekly.plist  # 停用
launchctl load   ~/Library/LaunchAgents/ai.openclaw.garmin-weekly.plist  # 启用
```

**日志**：
```bash
tail -f .openclaw/state/logs/garmin_weekly_launchd.log      # launchd stdout
tail -f .openclaw/state/logs/garmin_weekly_launchd.err.log  # launchd stderr
```

---

## 三、可获取的数据全览

### 3.1 运动活动

| 数据 | 命令/方法 | 说明 |
|------|-----------|------|
| 活动列表 | `get_activities_by_date()` | 跑步/骑行/力量等，含距离、时长、配速、心率、爬升、卡路里、训练负荷 |
| 活动详情 | `get_activity()` | 单次活动完整数据 |
| 配速分段 | `get_activity_splits()` | 每公里/每圈的配速、心率 |
| 详细图表 | `get_activity_details()` | 逐秒心率、配速、海拔曲线 |
| 力量训练组数 | `get_activity_exercise_sets()` | 每个动作的组数、次数、重量 |
| 活动天气 | `get_activity_weather()` | 当时的温度、湿度、风速 |
| 个人记录 | `get_personal_record()` | 最快 5km/10km/半马/全马等 PR |

**问 fitcoach 的示例问题**：
- 「帮我看下最近一次跑步的每公里配速和心率分段」
- 「我上周跑了几次，总里程多少，平均配速怎样」
- 「我的 10km 个人记录是多少，怎么提升」

---

### 3.2 训练状态与恢复

| 数据 | 方法 | 今日数据示例 |
|------|------|------------|
| **训练准备度** | `get_training_readiness()` | 65/100（中等）|
| **晨间准备度** | `get_morning_training_readiness()` | 早起后更新，含睡眠评分 |
| **训练状态** | `get_training_status()` | VO2Max 趋势、训练负荷平衡 |
| **HRV** | `get_hrv_data()` | 本周均值 33ms，状态 GOOD |
| **恢复时间** | 包含在训练准备度中 | 当前剩余恢复时间（小时）|
| **身体电量** | `get_body_battery()` | 0-100 分，全天变化曲线 |
| **压力值** | `get_stress_data()` | 全天压力水平（低/中/高） |

**训练准备度详细字段**（今日实际数据）：
```
总分：65/100（MODERATE）
- 睡眠质量：59分（POOR），权重 39%
- 恢复时间：GOOD（99th），权重 99%
- 急慢性负荷比 ACWR：VERY_GOOD，权重 100%
- 压力历史：GOOD
- HRV：GOOD（74th，周均 33ms）
- 睡眠历史：GOOD（74th）
```

**问 fitcoach 的示例问题**：
- 「今天我的训练准备度是多少，适合练大强度吗」
- 「我的 HRV 最近趋势怎样，是否过度训练」
- 「今天身体电量怎样，我下午能跑步吗」
- 「帮我看看最近一周的睡眠和恢复情况」

---

### 3.3 生理与健康

| 数据 | 方法 | 说明 |
|------|------|------|
| 睡眠 | `get_sleep_data()` | 深睡/浅睡/REM/清醒时长，睡眠评分 |
| 静息心率 | `get_rhr_day()` | 每日静息心率，长期趋势反映有氧基础 |
| 血氧 SpO2 | `get_spo2_data()` | 睡眠中血氧变化（需手表支持） |
| 步数 | `get_daily_steps()` | 每日步数，每周汇总 |
| 爬楼 | `get_floors()` | 每日爬楼层数 |
| 体重/体成分 | `get_body_composition()` | 体重、体脂率等（需手动录入或体脂秤） |
| 水合 | `get_hydration_data()` | 每日饮水量（需手动记录） |
| 血压 | `get_blood_pressure()` | 如有录入 |
| 强度分钟 | `get_intensity_minutes_data()` | WHO 推荐每周 150 分钟中强度活动 |

**问 fitcoach 的示例问题**：
- 「我最近一周的睡眠怎样，对跑步恢复有影响吗」
- 「我的静息心率近期有没有变化」
- 「帮我看下最近的步数，日均多少」

---

### 3.4 训练能力与比赛预测

| 数据 | 方法 | 今日实际数据 |
|------|------|------------|
| **比赛预测** | `get_race_predictions()` | 5K: 23:20 / 10K: 50:25 / 半马: 1:55:14 / 全马: 4:16:30 |
| **VO2Max** | `get_max_metrics()` / `get_training_status()` | 最大摄氧量估算值 |
| **乳酸阈值** | `get_lactate_threshold()` | 乳酸阈值心率/配速（需跑步测试） |
| **耐力评分** | `get_endurance_score()` | Garmin 耐力综合评分 |
| **爬坡评分** | `get_hill_score()` | 爬坡能力评分 |
| **健身年龄** | `get_fitnessage_data()` | 基于 VO2Max 的生理年龄 |

**问 fitcoach 的示例问题**：
- 「我当前的比赛预测成绩是多少，要跑进 5km 23 分需要怎么训练」
- 「我的 VO2Max 是多少，处于什么水平」
- 「我的半马预测是 1:55，要破 1:50 需要多久」

---

### 3.5 佳明教练训练计划 ✅

**可以获取**，包括：

| 数据 | 方法 | 说明 |
|------|------|------|
| 训练计划列表 | `get_training_plans()` | 当前启用的所有计划 |
| 计划详情 | `get_training_plan_by_id(plan_id)` | 指定计划的完整内容 |
| 自适应计划 | `get_adaptive_training_plan_by_id(plan_id)` | 佳明教练动态调整的计划 |
| 单次训练详情 | `get_scheduled_workout_by_id(id)` | 某次计划训练的具体要求 |
| 自定义训练库 | `get_workouts()` | 你存储的所有自定义训练 |
| 下载训练文件 | `download_workout(workout_id)` | 下载 FIT/TCX 格式训练文件 |

**问 fitcoach 的示例问题**：
- 「帮我看下当前的佳明教练计划，今天安排了什么训练」
- 「佳明教练本周给我安排了几次跑步，强度怎样」
- 「我的计划和实际完成情况对比，达标率多少」

---

### 3.6 装备

| 数据 | 方法 | 说明 |
|------|------|------|
| 装备列表 | `get_gear()` | 跑鞋、自行车等 |
| 装备里程 | `get_gear_stats()` | 累计使用里程（跑鞋寿命监控） |

**问 fitcoach 的示例问题**：
- 「我的跑鞋跑了多少公里了，该换了吗」

---

## 四、在 fitcoach 群中如何使用

### 直接问（fitcoach 会自动调用脚本）

在飞书 fitcoach 群 @ 机器人，直接用自然语言提问：

```
@fitcoach 帮我分析一下最近两周的跑步数据，训练是否规律

@fitcoach 今天适合跑步吗，看下我的训练准备度和昨晚睡眠

@fitcoach 我的比赛预测成绩是多少，5km 想跑进 22 分需要怎么提高

@fitcoach 帮我看下最近一次跑步的配速分段，哪几公里掉速了

@fitcoach 我的 HRV 最近趋势如何，有没有过度训练的迹象

@fitcoach 佳明教练这周给我安排了什么，和我实际的训练匹配吗
```

### 自动推送（已配置）

**实时推送**（garmin_notify.sh，launchd 每小时）：
每当有新运动记录同步到 Garmin Connect，最长 1 小时内自动：
1. 检测到新活动（对比上次 activity ID）
2. 触发 fitcoach 分析
3. 推送到飞书 fitcoach 群

**周报推送**（garmin_weekly_push.sh，launchd 每周一 07:30）：
拉取最近 7 天完整运动数据，fitcoach 生成本周建议和调整方向，推送到飞书群。

两者均由 launchd 托管，与 openclaw gateway 机制一致——Mac 睡眠期间不运行，但**唤醒后会立即补跑错过的任务**，无需手动干预。

---

## 五、常见问题

**Q：Token 失效了怎么办？**
看到 `连接失败，请先运行登录脚本` 时，在自己终端运行：
```bash
python3 scripts/garmin_login_cn.py
```

**Q：launchd 任务没有触发？**
```bash
launchctl list | grep garmin    # 检查是否已加载，第二列为上次退出码（0 = 正常）
tail -f .openclaw/state/logs/garmin_notify_launchd.err.log  # 看报错
```
注意：Mac 睡眠期间不会运行，唤醒后会自动补跑。

**Q：手动强制触发一次推送？**
```bash
rm ~/.garmin_last_activity_id   # 清除状态，让它重新检测
bash scripts/garmin_notify.sh
```

**Q：佳明教练训练计划 ID 怎么查？**
```python
python3 -c "
import os; from garminconnect import Garmin
c = Garmin(is_cn=True); c.login(os.path.expanduser('~/.garth_cn'))
import json; print(json.dumps(c.get_training_plans(), ensure_ascii=False, indent=2))
"
```

**Q：最近数据断档（11 月到 1 月没有）？**
这段时间的跑步数据可能在佳明中国版账号里，但没有同步到国际版。两个账号数据各自独立，脚本已优先读中国版（`--cn`）。

---

## 六、数据更新时机

佳明手表完成运动后：
- 与手机蓝牙连接时立即同步
- 同步到 Garmin Connect 约需 1-5 分钟
- launchd 每小时检测，最长延迟 60 分钟触发推送（Mac 睡眠期间暂停，唤醒后补跑）
