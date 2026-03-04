#!/usr/bin/env bash
set -euo pipefail

# 安全自动拉取：
# - 仅在 git 工作区干净时执行 pull --rebase
# - 当前分支需有 upstream
# - 有冲突/失败时只记录，不做破坏性操作

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${REPO_ROOT}/.openclaw/state/logs"
LOG_FILE="${LOG_DIR}/git-auto-pull.log"

mkdir -p "${LOG_DIR}"

ts() {
  date "+%Y-%m-%d %H:%M"
}

log() {
  echo "[$(ts)] $*" | tee -a "${LOG_FILE}" >/dev/null
}

cd "${REPO_ROOT}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "skip: not a git repository (${REPO_ROOT})"
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  log "skip: remote 'origin' not configured"
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  log "skip: working tree not clean (has local changes)"
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${BRANCH}" == "HEAD" ]]; then
  log "skip: detached HEAD"
  exit 0
fi

if ! git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
  log "skip: branch '${BRANCH}' has no upstream"
  exit 0
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}")"

if ! git fetch --prune origin >>"${LOG_FILE}" 2>&1; then
  log "fail: git fetch failed"
  exit 1
fi

LOCAL_SHA="$(git rev-parse @)"
REMOTE_SHA="$(git rev-parse "@{u}")"
BASE_SHA="$(git merge-base @ "@{u}")"

if [[ "${LOCAL_SHA}" == "${REMOTE_SHA}" ]]; then
  log "ok: already up-to-date (${BRANCH} -> ${UPSTREAM})"
  exit 0
fi

if [[ "${LOCAL_SHA}" == "${BASE_SHA}" ]]; then
  if git pull --rebase --stat >>"${LOG_FILE}" 2>&1; then
    NEW_SHA="$(git rev-parse @)"
    log "ok: pulled ${BRANCH} -> ${UPSTREAM} (${LOCAL_SHA:0:8} -> ${NEW_SHA:0:8})"
    exit 0
  fi
  log "fail: git pull --rebase failed (manual resolve needed)"
  exit 1
fi

if [[ "${REMOTE_SHA}" == "${BASE_SHA}" ]]; then
  log "skip: local branch ahead of upstream (push manually)"
  exit 0
fi

log "skip: local and remote diverged (pull/push manually)"
exit 0
