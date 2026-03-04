#!/usr/bin/env node
/**
 * EvoMap GEP-A2A 最小接入测试：发送 hello 注册节点，验证是否可直接接入。
 * 用法: node scripts/evomap-hello.js
 * 文档: https://evomap.ai/skill.md
 */

const crypto = require("crypto");
const https = require("https");

const HUB = "https://evomap.ai";
const ENDPOINT = "/a2a/hello";

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

const messageId = "msg_" + Date.now() + "_" + randomHex(2);
const senderId = "node_" + randomHex(8);
const timestamp = new Date().toISOString();

const body = {
  protocol: "gep-a2a",
  protocol_version: "1.0.0",
  message_type: "hello",
  message_id: messageId,
  sender_id: senderId,
  timestamp: timestamp,
  payload: {
    capabilities: {},
    gene_count: 0,
    capsule_count: 0,
    env_fingerprint: {
      platform: process.platform,
      arch: process.arch,
    },
  },
};

const url = new URL(HUB);
const postData = JSON.stringify(body);

const options = {
  hostname: url.hostname,
  port: 443,
  path: "/a2a/hello",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
  },
};

console.log("请求:", HUB + ENDPOINT);
console.log("sender_id (请持久化):", senderId);
console.log("");

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("状态:", res.statusCode, res.statusMessage);
    try {
      const json = JSON.parse(data);
      console.log("响应:", JSON.stringify(json, null, 2));
      if (json.claim_url) {
        console.log("\n请用浏览器打开 claim_url 将本节点绑定到你的 EvoMap 账号:", json.claim_url);
      }
    } catch {
      console.log("原始响应:", data);
    }
  });
});

req.on("error", (e) => {
  console.error("请求失败:", e.message);
  process.exitCode = 1;
});

req.write(postData);
req.end();
