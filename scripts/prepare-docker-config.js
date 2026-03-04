#!/usr/bin/env node
/**
 * 将本机绝对路径配置转换为 Docker 路径（/app）。
 *
 * 用法：
 *   node scripts/prepare-docker-config.js --input .openclaw/config.local --output .openclaw/config
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

function readArg(name, fallback = "") {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const input = path.resolve(repoRoot, readArg("--input", ".openclaw/config"));
const output = path.resolve(repoRoot, readArg("--output", ".openclaw/config"));
const localRoot = readArg("--local-root", "/Users/zhangshuo/openclawxitong");
const dockerRoot = readArg("--docker-root", "/app");

if (!fs.existsSync(input)) {
  console.error("[prepare-docker-config] input not found:", input);
  process.exit(1);
}

const raw = fs.readFileSync(input, "utf8");
let cfg;
try {
  cfg = JSON.parse(raw);
} catch (err) {
  console.error("[prepare-docker-config] invalid JSON:", err.message);
  process.exit(1);
}

function rewrite(value) {
  if (typeof value === "string") {
    return value.replaceAll(localRoot, dockerRoot);
  }
  if (Array.isArray(value)) {
    return value.map(rewrite);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewrite(v);
    return out;
  }
  return value;
}

const outCfg = rewrite(cfg);
fs.writeFileSync(output, JSON.stringify(outCfg, null, 2) + "\n", "utf8");

console.log("[prepare-docker-config] wrote:", output);
console.log("[prepare-docker-config] replace:", `${localRoot} -> ${dockerRoot}`);
