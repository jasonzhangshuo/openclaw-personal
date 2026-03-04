#!/usr/bin/env node
/**
 * 根据「任务名 + 事件类型」向 task_events.jsonl 追加一条事件，供规划教练在用户同步状态时调用。
 * 用法（规划教练用 exec 调用）：
 *   node scripts/sync-task-event.js --label "跑步" --event complete
 *   node scripts/sync-task-event.js --label "健康餐" --event complete --reason "吃好了"
 *   node scripts/sync-task-event.js --label "午餐轻食" --event abandon --reason "老婆做饭"
 *   node scripts/sync-task-event.js --label "跑步" --event postpone --postpone-to-start 18:00 --postpone-to-end 19:00 --reason "晚点跑"
 *
 * 参数：
 *   --label "任务名"  与当日计划中的任务匹配（部分匹配即可，如 "跑步" "正念" "健康餐"）
 *   --event complete|start|abandon|postpone
 *   --reason "原因"   可选，abandon/postpone 时建议填
 *   --postpone-to-start HH:MM  --postpone-to-end HH:MM   postpone 时必填
 *
 * 数据目录：
 *   - PERSONALOS_DATA（优先）
 *   - 默认：<repo>/.openclaw/workspace-lifecoach/data/personalos
 * 计划目录：
 *   - TOMORROW_PLAN_DIR（优先）
 *   - 默认：<repo>/.openclaw/workspace-lifecoach/data/tomorrow_plan
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR =
  process.env.PERSONALOS_DATA ||
  path.join(REPO_ROOT, ".openclaw", "workspace-lifecoach", "data", "personalos");
const TOMORROW_PLAN_DIR =
  process.env.TOMORROW_PLAN_DIR ||
  path.join(REPO_ROOT, ".openclaw", "workspace-lifecoach", "data", "tomorrow_plan");
const TZ = "Asia/Shanghai";

function todayShanghai() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function nowISO() {
  return new Date().toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T") + "+08:00";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { label: "", event: "", reason: "", postponeToStart: "", postponeToEnd: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--label" && args[i + 1]) out.label = args[++i];
    else if (args[i] === "--event" && args[i + 1]) out.event = args[++i];
    else if (args[i] === "--reason" && args[i + 1]) out.reason = args[++i];
    else if (args[i] === "--postpone-to-start" && args[i + 1]) out.postponeToStart = args[++i];
    else if (args[i] === "--postpone-to-end" && args[i + 1]) out.postponeToEnd = args[++i];
  }
  return out;
}

function findTaskFromDailySummary(date, label) {
  const p = path.join(DATA_DIR, "daily_summary", `${date}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const tasks = data.tasks || [];
  const lower = (label || "").trim().toLowerCase();
  for (const t of tasks) {
    const taskLabel = (t.label || "").trim();
    if (taskLabel.toLowerCase().includes(lower) || lower.includes(taskLabel.toLowerCase()))
      return {
        task_id: t.task_id,
        label: taskLabel,
        planned_start: t.planned_start || "",
        planned_end: t.planned_end || "",
      };
  }
  return null;
}

function findTaskFromTomorrowPlan(date, label) {
  const p = path.join(TOMORROW_PLAN_DIR, `${date}.md`);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  const lower = (label || "").trim().toLowerCase();
  const lines = raw.split(/\n/);
  let inTable = false;
  let index = 0;
  const headerRe = /^\s*\|?\s*时间\s*\|/;
  const rowRe = /^\s*\|?\s*([^|]+)\s*\|\s*([^|]+)/;
  for (const line of lines) {
    if (headerRe.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && rowRe.test(line)) {
      const m = line.match(rowRe);
      const timeCell = (m[1] || "").trim();
      const taskCell = (m[2] || "").trim().replace(/\s*$/, "");
      if (!taskCell || taskCell === "任务" || taskCell === "---") continue;
      index++;
      const taskLabel = taskCell.replace(/^~~.*~~\s*/, "").trim();
      if (!taskLabel) continue;
      if (taskLabel.toLowerCase().includes(lower) || lower.includes(taskLabel.toLowerCase())) {
        let planned_start = "";
        let planned_end = "";
        const timeMatch = timeCell.match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/);
        if (timeMatch) {
          planned_start = timeMatch[1];
          planned_end = timeMatch[2];
        }
        return {
          task_id: `md_${date}_${index}`,
          label: taskLabel,
          planned_start,
          planned_end,
        };
      }
    }
  }
  return null;
}

function main() {
  const { label, event, reason, postponeToStart, postponeToEnd } = parseArgs();
  const date = todayShanghai();
  const eventTime = nowISO();

  if (!label || !event) {
    console.error("Usage: node sync-task-event.js --label \"任务名\" --event complete|start|abandon|postpone [--reason ...] [--postpone-to-start HH:MM --postpone-to-end HH:MM]");
    process.exit(2);
  }
  const validEvents = ["complete", "start", "abandon", "postpone"];
  if (!validEvents.includes(event)) {
    console.error("--event must be one of:", validEvents.join(", "));
    process.exit(2);
  }
  if (event === "postpone" && (!postponeToStart || !postponeToEnd)) {
    console.error("postpone requires --postpone-to-start and --postpone-to-end");
    process.exit(2);
  }

  let task = findTaskFromDailySummary(date, label) || findTaskFromTomorrowPlan(date, label);
  if (!task) {
    console.error("No task found for today matching label:", label);
    process.exit(3);
  }

  const base = {
    event_time: eventTime,
    date,
    task_id: task.task_id,
    event_type: event,
    label: task.label,
    planned_start: task.planned_start || "",
    planned_end: task.planned_end || "",
    reason: reason || "",
    source: "lifecoach_sync",
  };

  let payload = base;
  if (event === "postpone") {
    payload = {
      ...base,
      postpone_from_start: task.planned_start || "",
      postpone_from_end: task.planned_end || "",
      postpone_to_start: postponeToStart,
      postpone_to_end: postponeToEnd,
    };
  }

  const taskEventsPath = path.join(DATA_DIR, "task_events.jsonl");
  const line = JSON.stringify(payload) + "\n";
  fs.appendFileSync(taskEventsPath, line, "utf8");
  console.log("Appended:", base.event_type, base.label, base.task_id);
}

main();
