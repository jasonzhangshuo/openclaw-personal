#!/usr/bin/env node
/**
 * 每 120 分钟检查当日 heartbeat_logs 是否有新段落；若有且结论非 HEARTBEAT_OK，把**结论一句**发到规划群（兜底，不发整段日志）。
 * 数据源：HEARTBEAT_LOGS_DIR/YYYY-MM-DD.md（默认 personalOS/data/heartbeat_logs；推荐设为本项目 workspace-lifecoach/data/heartbeat_logs，与 HEARTBEAT.md 一致）。
 *
 * 用法：node scripts/lifecoach-heartbeat-send-to-feishu.js
 *
 * launchd 每 120 分钟（plist StartInterval=7200）：
 *   cp scripts/ai.openclaw.lifecoach-heartbeat-send.plist ~/Library/LaunchAgents/
 *   launchctl load ~/Library/LaunchAgents/ai.openclaw.lifecoach-heartbeat-send.plist
 *
 * 依赖：Jasonmemory 的 send_im_message.py（SEND_IM_SCRIPT_DIR）。
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const PLANNING_GROUP_CHAT_ID = "oc_b0f512c3328263b70ff9772c8288099f";
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || path.join(REPO_ROOT, ".openclaw", "state");
const HEARTBEAT_LOGS_DIR =
  process.env.HEARTBEAT_LOGS_DIR ||
  path.join(process.env.HOME || "/Users/zhangshuo", "personalOS", "data", "heartbeat_logs");
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
const LAST_SENT_LOG_FILE = path.join(STATE_DIR, "lifecoach-heartbeat-last-sent-log.json");
const MAX_MESSAGE_CHARS = 2000;

/** Healthchecks 监控：若配置了 HEALTHCHECKS_PING_LIFECOACH_SEND 则发 ping，success=false 发 /fail */
function pingHealthchecks(success) {
  const url = process.env.HEALTHCHECKS_PING_LIFECOACH_SEND;
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
  return path.join(HEARTBEAT_LOGS_DIR, `${todayShanghai()}.md`);
}

/**
 * 从段落首行解析时间 "## HH:MM 检查" 或 "## HH:MM 检查 - xxx"，返回分钟数便于比较。
 */
function parseSectionMinutes(section) {
  const firstLine = section.split("\n")[0] || "";
  const m = firstLine.match(/^##\s*(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * 解析 YYYY-MM-DD.md：按 ## 拆成段落，返回**时间最新**的一段（按 ## HH:MM 判断），
 * 而非文件顺序最后一段（agent 追加顺序可能乱序）。
 */
function getLatestLogSection(logPath) {
  if (!fs.existsSync(logPath)) return null;
  const raw = fs.readFileSync(logPath, "utf8").trim();
  if (!raw) return null;
  const sections = raw.split(/\n(?=##\s)/).filter((s) => s.trim());
  if (sections.length === 0) return null;
  let best = null;
  let bestMin = -1;
  for (const s of sections) {
    const trimmed = s.trim();
    if (!trimmed || trimmed.startsWith("# Heartbeat Logs")) continue;
    const min = parseSectionMinutes(trimmed);
    if (min >= 0 && min > bestMin) {
      bestMin = min;
      best = trimmed;
    }
  }
  if (!best && sections.length > 0) {
    const last = sections[sections.length - 1].trim();
    if (last && !last.startsWith("# Heartbeat Logs")) best = last;
  }
  return best;
}

/**
 * 从段落中提取「结论」一行，发群只发这一句（兜底不发整段日志）。
 * 匹配 "结论：" 或 "**结论**：" 后的内容，若无则退回简短兜底文案。
 */
function formatSectionAsMessage(section) {
  const trimmed = section.trim();
  if (!trimmed) return "";
  const conclusionMatch = trimmed.match(/(?:\*\*)?结论(?:\*\*)?[：:]\s*([^\n]+)/i);
  if (conclusionMatch && conclusionMatch[1].trim()) {
    const line = conclusionMatch[1].trim();
    if (line.toUpperCase() === "HEARTBEAT_OK") return "";
    return `【规划教练兜底】本次检查结论：${line}`;
  }
  return "【规划教练兜底】有一笔 heartbeat 检查需关注，请稍后看日志。";
}

/** 仅当结论不是 HEARTBEAT_OK 时才发群（结论 OK 表示无需推送，不触发兜底）。 */
function shouldSendSection(section) {
  const lower = section.toLowerCase();
  const hasConclusionOk =
    /结论[：:]\\s*heartbeat_ok/i.test(section) ||
    /\\*\\*结论\\*\\*[：:]\\s*HEARTBEAT_OK/i.test(section);
  return !hasConclusionOk;
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

/** 用段落第一行（通常是 "## 12:52 - 标题"）作为唯一 key，避免重复发送同一段。 */
function sectionKey(section) {
  const firstLine = section.split("\n")[0].trim();
  return firstLine.slice(0, 120);
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
      [scriptPath, "--chat-id", PLANNING_GROUP_CHAT_ID, "--text", text],
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
    console.log("Sent heartbeat log section to planning group:", key.slice(0, 50) + "...");
  } catch (err) {
    console.error("Send failed:", err.message);
    pingHealthchecks(false);
    process.exit(5);
  }
}

main();
