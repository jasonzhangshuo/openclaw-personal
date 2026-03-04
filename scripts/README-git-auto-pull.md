# Git 自动拉取（安全模式）

目标：在两台电脑切换时，减少忘记 `git pull` 的概率；采用「自动 pull、手动 push」策略。

## 策略说明

- 自动任务每 10 分钟执行一次。
- 仅当工作区干净（无未提交改动）才会拉取。
- 当前分支必须有 upstream（例如 `main -> origin/main`）。
- 本地领先远端或分叉时不会强拉，只记录日志，避免破坏本地现场。

## 文件

- 脚本：`scripts/git-auto-pull-safe.sh`
- launchd：`scripts/ai.openclaw.git-auto-pull.plist`
- 脚本日志：`.openclaw/state/logs/git-auto-pull.log`
- launchd 输出：`.openclaw/state/logs/git-auto-pull.launchd.log`

## 安装（本机）

```bash
chmod +x scripts/git-auto-pull-safe.sh
cp scripts/ai.openclaw.git-auto-pull.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/ai.openclaw.git-auto-pull.plist
```

## 卸载

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.git-auto-pull.plist
rm ~/Library/LaunchAgents/ai.openclaw.git-auto-pull.plist
```

## 手动验证

```bash
bash scripts/git-auto-pull-safe.sh
sed -n '1,120p' .openclaw/state/logs/git-auto-pull.log
```

## 建议工作流（两台电脑）

- 开工前：先看自动拉取日志是否成功；必要时手动 `git pull --rebase`。
- 收工前：手动提交并 `git push`。
- 不建议自动 push，避免把临时改动同步到另一台机器。

## 常见问题

- **开新 Cursor 对话会触发自动 pull 吗？**  
  不会。自动 pull 由 launchd 定时触发（`StartInterval=600`，每 10 分钟一次），和是否新开对话窗口无关。

- **如何一眼看同步状态？**  
  运行：

  ```bash
  chmod +x scripts/git-sync-status.sh
  bash scripts/git-sync-status.sh
  ```

  输出会显示：`Worktree`（clean/dirty）、`Ahead/Behind`、自动拉任务是否 loaded、最近一次自动拉结果。
