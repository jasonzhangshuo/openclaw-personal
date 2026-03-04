#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUTO_PULL_LOG="${REPO_ROOT}/.openclaw/state/logs/git-auto-pull.log"
AGENT_LABEL="ai.openclaw.git-auto-pull"

cd "${REPO_ROOT}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository: ${REPO_ROOT}"
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" == "HEAD" ]]; then
  branch="detached-HEAD"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  worktree_state="dirty"
else
  worktree_state="clean"
fi

upstream="(none)"
ahead="N/A"
behind="N/A"
if git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}")"
  read -r ahead behind < <(git rev-list --left-right --count @...@{u})
fi

agent_state="not_loaded"
if launchctl print "gui/$(id -u)/${AGENT_LABEL}" >/dev/null 2>&1; then
  agent_state="loaded"
fi

last_auto_pull="(no log yet)"
if [[ -f "${AUTO_PULL_LOG}" ]]; then
  # 取最后一行日志
  last_auto_pull="$(sed -n '$p' "${AUTO_PULL_LOG}")"
fi

echo "Repo: ${REPO_ROOT}"
echo "Branch: ${branch}"
echo "Worktree: ${worktree_state}"
echo "Upstream: ${upstream}"
echo "Ahead: ${ahead}"
echo "Behind: ${behind}"
echo "AutoPullAgent: ${agent_state} (${AGENT_LABEL})"
echo "LastAutoPull: ${last_auto_pull}"
