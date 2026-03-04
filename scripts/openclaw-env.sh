#!/usr/bin/env bash
# 在本项目下使用 OpenClaw 前 source 此文件，使 CLI 与 LaunchAgent 使用同一 config/state。
# 用法: source scripts/openclaw-env.sh  或  . scripts/openclaw-env.sh
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENCLAW_CONFIG_PATH="$REPO_ROOT/.openclaw/config"
export OPENCLAW_STATE_DIR="$REPO_ROOT/.openclaw/state"
