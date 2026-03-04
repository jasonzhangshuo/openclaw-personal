#!/usr/bin/env node
/**
 * 每 10 分钟检查 foodcoach 当日 HEARTBEAT_LOG 是否有新段落；若有，把最新段落发到饮食减重群。
 * 数据源：.openclaw/workspace-foodcoach/HEARTBEAT_LOG/YYYY-MM-DD.md（上海时区「今天」）。
 *
 * 用法：
 *   node scripts/foodcoach-heartbeat-send-to-feishu.js
 *
 * launchd 每 10 分钟（安装一次即可）：
 *   cp scripts/ai.openclaw.foodcoach-heartbeat-send.plist ~/Library/LaunchAgents/
 *   launchctl load ~/Library/LaunchAgents/ai.openclaw.foodcoach-heartbeat-send.plist
 *
 * 依赖：Jasonmemory 的 send_im_message.py（SEND_IM_SCRIPT_DIR 或默认 memory-mcp-server 路径）。
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const FOODCOACH_GROUP_CHAT_ID = "oc_d58072ebeb9a73604d17118e5f9bf01b";
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || path.join(REPO_ROOT, ".openclaw", "state");
const HEARTBEAT_LOG_DIR = path.join(REPO_ROOT, ".openclaw", "workspace-foodcoach", "HEARTBEAT_LOG");
const SEND_IM_SCRIPT_DIR =
  process.env.SEND_IM_SCRIPT_DIR ||
  path.join(
    process.env.HOME || "/Users/zhangshuo",
    "Library/Mobile Documents/com~apple~CloudDocs/Jasonmemory/memory-mcp-server"
  );
const PYTHON_BIN = (() => {
  const venvPy = path.join(SEND_IM_SCRIPT_DIR, ".venv", "bin", "python");
  return fs.existsSync(venvPy) ? venvPy : "python3";
})();
const LAST_SENT_LOG_FILE = path.join(STATE_DIR, "foodcoach-heartbeat-last-sent-log.json");
const MAX_MESSAGE_CHARS = 2000;

/** Healthchecks 监控：若配置了 HEALTHCHECKS_PING_FOODCOACH_SEND 则发 ping，success=false 发 /fail */
function pingHealthchecks(success) {
  const url = process.env.HEALTHCHECKS_PING_FOODCOACH_SEND;
  if (!url || url.includes("PASTE_UUID_HERE") || url.includes("REPLACE")) return;
  const pingUrl = success ? url : url.replace(/\/?$/, "/fail");
  try {
    execSync(`curl -fsS -m 10 "${pingUrl}"`, { stdio: "ignore" });
  } catch (_) {}
}

function todayShanghai() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function getLogPath() {
  return path.join(HEARTBEAT_LOG_DIR, `${todayShanghai()}.md`);
}

/**
 * 解析 YYYY-MM-DD.md：按 ## 拆成段落，返回最后一个完整段落（标题 + 正文）。
 */
function getLatestLogSection(logPath) {
  if (!fs.existsSync(logPath)) return null;
  const raw = fs.readFileSync(logPath, "utf8").trim();
  if (!raw) return null;
  const sections = raw.split(/\n(?=##\s)/).filter((s) => s.trim());
  if (sections.length === 0) return null;
  const last = sections[sections.length - 1].trim();
  if (!last || last.startsWith("# Heartbeat 日志")) return null;
  return last;
}

function formatSectionAsMessage(section) {
  const trimmed = section.trim();
  if (!trimmed) return "";
  let msg = trimmed;
  if (msg.length > MAX_MESSAGE_CHARS) {
    msg = msg.slice(0, MAX_MESSAGE_CHARS - 20) + "\n\n…（已截断）";
  }
  return msg;
}

function getLastSentSectionKey() {
  if (!fs.existsSync(LAST_SENT_LOG_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(LAST_SENT_LOG_FILE, "utf8"));
    return data.sectionKey || null;
  } catch {
    return null;
  }
}

function setLastSentSectionKey(sectionKey) {
  const dir = path.dirname(LAST_SENT_LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    LAST_SENT_LOG_FILE,
    JSON.stringify({ sectionKey, at: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

function sectionKey(section) {
  const firstLine = section.split("\n")[0].trim();
  return firstLine.slice(0, 120);
}

/** 仅当结论不是 HEARTBEAT_OK 时才发群（结论 OK 表示无需推送，不触发兜底）。 */
function shouldSendSection(section) {
  const lower = section.toLowerCase();
  const hasConclusionOk =
    /结论[：:]\s*heartbeat_ok/i.test(section) ||
    /\*\*结论\*\*[：:]\s*HEARTBEAT_OK/i.test(section);
  return !hasConclusionOk;
}

function sendViaPython(text) {
  const scriptPath = path.join(SEND_IM_SCRIPT_DIR, "scripts", "send_im_message.py");
  if (!fs.existsSync(scriptPath)) {
    console.error("send_im_message.py not found at", scriptPath);
    process.exit(4);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(
      PYTHON_BIN,
      [scriptPath, "--chat-id", FOODCOACH_GROUP_CHAT_ID, "--text", text],
      {
        cwd: SEND_IM_SCRIPT_DIR,
        env: { ...process.env, PYTHONPATH: SEND_IM_SCRIPT_DIR },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (ch) => (stderr += ch));
    child.stdout.on("data", (ch) => (stdout += ch));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`send_im_message.py exited ${code}: ${stderr || stdout}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  pingHealthchecks(true);
  const logPath = getLogPath();
  const section = getLatestLogSection(logPath);
  if (!section) {
    console.log("No heartbeat log section for today:", todayShanghai());
    return;
  }

  if (!shouldSendSection(section)) {
    console.log("Section conclusion is HEARTBEAT_OK, skip sending to group");
    return;
  }

  const key = sectionKey(section);
  const lastKey = getLastSentSectionKey();
  if (lastKey === key) {
    console.log("Already sent this section:", key.slice(0, 50) + "...");
    return;
  }

  const message = formatSectionAsMessage(section);
  if (!message) {
    console.log("Section empty after format");
    return;
  }

  try {
    await sendViaPython(message);
    setLastSentSectionKey(key);
    console.log("Sent heartbeat log section to foodcoach group:", key.slice(0, 50) + "...");
  } catch (err) {
    console.error("Send failed:", err.message);
    pingHealthchecks(false);
    process.exit(5);
  }
}

main();
