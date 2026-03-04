#!/usr/bin/env sh
set -eu

export OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-/app/.openclaw/config}"
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-/app/.openclaw/state}"
export PERSONALOS_DATA="${PERSONALOS_DATA:-/app/.openclaw/workspace-lifecoach/data/personalos}"
export TOMORROW_PLAN_DIR="${TOMORROW_PLAN_DIR:-/app/.openclaw/workspace-lifecoach/data/tomorrow_plan}"
export TZ="${TZ:-Asia/Shanghai}"

mkdir -p "${OPENCLAW_STATE_DIR}"
mkdir -p "${PERSONALOS_DATA}"
mkdir -p "${TOMORROW_PLAN_DIR}"

if [ ! -f "${OPENCLAW_CONFIG_PATH}" ]; then
  echo "[openclaw-entrypoint] config not found: ${OPENCLAW_CONFIG_PATH}"
  echo "[openclaw-entrypoint] mount your config file before starting container"
  exit 1
fi

exec openclaw "$@"
