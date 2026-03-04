#!/usr/bin/env node
/**
 * 规划教练计划落盘兜底脚本
 * 从 lifecoach 规划群的 session 中取最后一条「像计划」的 assistant 回复，写入 tomorrow_plan/YYYY-MM-DD.md
 * 用法：
 *   node scripts/lifecoach-plan-fallback.js --tomorrow   # 写入明天日期（用于 23:05 在 23:00 cron 之后）
 *   node scripts/lifecoach-plan-fallback.js --today       # 写入今天日期（用于白天用户要今日计划后兜底）
 *   node scripts/lifecoach-plan-fallback.js --date 2026-02-24
 */

const fs = require("fs");
const path = require("path");

const LIFECOACH_SESSION_KEY = "agent:lifecoach:feishu:group:oc_b0f512c3328263b70ff9772c8288099f";
const TOMORROW_PLAN_DIR = "/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan";
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || path.join(REPO_ROOT, ".openclaw", "state");

function getDateArg() {
  const args = process.argv.slice(2);
  if (args.includes("--date")) {
    const i = args.indexOf("--date");
    if (args[i + 1]) return args[i + 1];
  }
  if (args.includes("--tomorrow")) {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = fmt.formatToParts(new Date());
    const y = parseInt(parts.find((p) => p.type === "year").value, 10);
    const m = parseInt(parts.find((p) => p.type === "month").value, 10) - 1;
    const d = parseInt(parts.find((p) => p.type === "day").value, 10);
    const tomorrow = new Date(y, m, d + 1);
    return tomorrow.toISOString().slice(0, 10);
  }
  if (args.includes("--today")) {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;
    return `${y}-${m}-${d}`;
  }
  return null;
}

function getSessionFilePath() {
  const sessionsPath = path.join(STATE_DIR, "agents", "lifecoach", "sessions", "sessions.json");
  if (!fs.existsSync(sessionsPath)) return null;
  const data = JSON.parse(fs.readFileSync(sessionsPath, "utf8"));
  const session = data[LIFECOACH_SESSION_KEY];
  if (!session || !session.sessionFile) return null;
  return session.sessionFile;
}

function extractTextFromContent(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n\n");
}

function looksLikePlan(text) {
  if (!text || text.length < 80) return false;
  return /时间|安排|计划|任务|表|^\|/.test(text);
}

function getLastPlanLikeMessage(jsonlPath) {
  if (!fs.existsSync(jsonlPath)) return null;
  const lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
  let lastPlan = null;
  let lastAny = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (obj.type !== "message" || !obj.message || obj.message.role !== "assistant") continue;
    const text = extractTextFromContent(obj.message.content);
    if (!text) continue;
    lastAny = text;
    if (looksLikePlan(text)) {
      lastPlan = text;
      break;
    }
  }
  return lastPlan || lastAny;
}

function main() {
  const date = getDateArg();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Usage: node lifecoach-plan-fallback.js --tomorrow | --today | --date YYYY-MM-DD");
    process.exit(1);
  }

  const sessionFile = getSessionFilePath();
  if (!sessionFile) {
    console.error("lifecoach session not found in", path.join(STATE_DIR, "agents", "lifecoach", "sessions", "sessions.json"));
    process.exit(2);
  }

  const body = getLastPlanLikeMessage(sessionFile);
  if (!body) {
    console.error("No assistant message found in", sessionFile);
    process.exit(3);
  }

  const outDir = TOMORROW_PLAN_DIR;
  const outPath = path.join(outDir, `${date}.md`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const header = `# ${date} 计划\n\n（由规划教练会话兜底写入，若与飞书群内容一致可忽略重复）\n\n---\n\n`;
  fs.writeFileSync(outPath, header + body, "utf8");
  console.log("Wrote", outPath);
}

main();
