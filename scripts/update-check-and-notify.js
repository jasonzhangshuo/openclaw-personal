#!/usr/bin/env node
/**
 * 每 48 小时由 launchd 调用：跑更新检查（中文报告 + DeepSeek 翻译）→ 若有新版本则把报告发到脑暴群。
 * 依赖：check-openclaw-update-with-relevance.js；发群依赖 send_im_message.py（SEND_IM_SCRIPT_DIR，同 lifecoach-heartbeat-send）。
 *
 * 用法：node scripts/update-check-and-notify.js
 * 需在项目根执行，或设置 OPENCLAW_PROJECT。建议同时设 DEEPSEEK_API_KEY（.openclaw/.env）以用 DeepSeek 翻译。
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = process.env.OPENCLAW_PROJECT || path.resolve(__dirname, '..');
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || path.join(REPO_ROOT, '.openclaw', 'state');
const REPORT_PATH = path.join(STATE_DIR, 'update-check-report.md');
const BRAINSTORM_CHAT_ID = 'oc_f5666943630bbbb828f5d0703871cdf4';
const SEND_IM_SCRIPT_DIR =
  process.env.SEND_IM_SCRIPT_DIR ||
  path.join(
    process.env.HOME || require('os').homedir(),
    'Library/Mobile Documents/com~apple~CloudDocs/Jasonmemory/memory-mcp-server'
  );
const MAX_MESSAGE_CHARS = 3800;

function loadEnv(dir) {
  const envPath = path.join(dir, '.openclaw', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

function sendToFeishu(text) {
  const scriptPath = path.join(SEND_IM_SCRIPT_DIR, 'scripts', 'send_im_message.py');
  if (!fs.existsSync(scriptPath)) {
    console.error('send_im_message.py not found at', scriptPath, '；跳过发群。可设 SEND_IM_SCRIPT_DIR');
    return Promise.reject(new Error('send_im_message.py not found'));
  }
  const py = path.join(SEND_IM_SCRIPT_DIR, '.venv', 'bin', 'python');
  const pythonBin = fs.existsSync(py) ? py : 'python3';
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [scriptPath, '--chat-id', BRAINSTORM_CHAT_ID, '--text', text],
      { cwd: SEND_IM_SCRIPT_DIR, env: { ...process.env, PYTHONPATH: SEND_IM_SCRIPT_DIR }, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (c) => (stderr += c));
    child.stdout.on('data', (c) => (stdout += c));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`send_im_message.py exited ${code}: ${stderr || stdout}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  loadEnv(REPO_ROOT);
  process.env.OPENCLAW_PROJECT = REPO_ROOT;
  process.env.OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || path.join(REPO_ROOT, '.openclaw', 'config');
  process.env.OPENCLAW_STATE_DIR = STATE_DIR;

  const checkScript = path.join(REPO_ROOT, 'scripts', 'check-openclaw-update-with-relevance.js');
  if (!fs.existsSync(checkScript)) {
    console.error('check script not found:', checkScript);
    process.exit(2);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [checkScript, '--zh', '--write-report=' + REPORT_PATH],
      { cwd: REPO_ROOT, env: process.env, stdio: 'inherit' }
    );
    child.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error('check script exited ' + code));
        return;
      }
      if (!fs.existsSync(REPORT_PATH)) {
        resolve();
        return;
      }
      const report = fs.readFileSync(REPORT_PATH, 'utf8');
      if (!report.includes('→ 最新版本')) {
        console.log('无新版本，不发群');
        resolve();
        return;
      }
      const toSend = report.length > MAX_MESSAGE_CHARS
        ? report.slice(0, MAX_MESSAGE_CHARS) + '\n\n（完整报告见 .openclaw/state/update-check-report.md）'
        : report;
      try {
        await sendToFeishu(toSend);
        console.log('已把更新报告发到脑暴群');
      } catch (e) {
        console.error('发群失败:', e.message);
      }
      resolve();
    });
    child.on('error', reject);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
