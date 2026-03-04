#!/usr/bin/env node
/**
 * 冒烟测试：heartbeat / cron announce 推送到飞书群的配置与路径是否就绪
 * 验证项：config 中 lifecoach/foodcoach 的 heartbeat.target+to、feishu 账户、至少一条 cron 使用 feishu 投递
 * 用法: node scripts/smoke-test-heartbeat-delivery.js
 * 说明：本脚本不调用模型、不实际发消息；仅验证配置。完整 E2E 需在 API 正常时执行 cron run 并查看群消息或 gateway 日志中的 delivery 成功记录。
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.env.OPENCLAW_PROJECT || path.resolve(__dirname, '..');
const configPath =
  process.env.OPENCLAW_CONFIG_PATH ||
  path.join(projectRoot, '.openclaw', 'config');

const checks = [];
function ok(name, condition, message) {
  checks.push({
    name,
    ok: !!condition,
    message: message || (condition ? 'ok' : 'fail'),
  });
}

if (!fs.existsSync(configPath)) {
  console.error('Config not found:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const agents = config.agents?.list || [];
const channels = config.channels || {};
const feishu = channels.feishu;

// 1. Feishu channel 存在且至少有一个 account（含 default，Gateway 投递时用）
ok(
  'channels.feishu 存在',
  !!feishu,
  feishu ? 'ok' : 'config 中缺少 channels.feishu'
);
ok(
  'feishu.accounts 含 main',
  feishu?.accounts?.main,
  feishu?.accounts?.main ? 'ok' : '缺少 feishu.accounts.main'
);
ok(
  'feishu.accounts 含 default',
  feishu?.accounts?.default,
  feishu?.accounts?.default
    ? 'ok'
    : '缺少 feishu.accounts.default（heartbeat 投递时 Gateway 会查 default）'
);

// 2. lifecoach / foodcoach 的 heartbeat 显式配置为 feishu + 群 ID
const lifecoach = agents.find((a) => a.id === 'lifecoach');
const foodcoach = agents.find((a) => a.id === 'foodcoach');

ok('agents.list 含 lifecoach', !!lifecoach, lifecoach ? 'ok' : '缺少 lifecoach');
ok('agents.list 含 foodcoach', !!foodcoach, foodcoach ? 'ok' : '缺少 foodcoach');

const hb = (a) => a?.heartbeat;
ok(
  'lifecoach.heartbeat 存在',
  !!hb(lifecoach),
  hb(lifecoach) ? 'ok' : 'lifecoach 未配置 heartbeat'
);
ok(
  'foodcoach.heartbeat 存在',
  !!hb(foodcoach),
  hb(foodcoach) ? 'ok' : 'foodcoach 未配置 heartbeat'
);

ok(
  'lifecoach.heartbeat.target 为 feishu',
  hb(lifecoach)?.target === 'feishu',
  hb(lifecoach)?.target === 'feishu' ? 'ok' : `target=${hb(lifecoach)?.target}`
);
ok(
  'foodcoach.heartbeat.target 为 feishu',
  hb(foodcoach)?.target === 'feishu',
  hb(foodcoach)?.target === 'feishu' ? 'ok' : `target=${hb(foodcoach)?.target}`
);

ok(
  'lifecoach.heartbeat.to 为群 ID（oc_）',
  typeof hb(lifecoach)?.to === 'string' && hb(lifecoach).to.startsWith('oc_'),
  hb(lifecoach)?.to ? 'ok' : '缺少 heartbeat.to 或非群 ID'
);
ok(
  'foodcoach.heartbeat.to 为群 ID（oc_）',
  typeof hb(foodcoach)?.to === 'string' && hb(foodcoach).to.startsWith('oc_'),
  hb(foodcoach)?.to ? 'ok' : '缺少 heartbeat.to 或非群 ID'
);

// 3. 至少有一条 cron 使用 announce + feishu 投递（说明路径在用）
const jobsPath =
  process.env.OPENCLAW_STATE_DIR?.replace(/\/?$/, '') ||
  path.join(projectRoot, '.openclaw', 'state');
const jobsFile = path.join(jobsPath, 'cron', 'jobs.json');
let hasCronFeishuDelivery = false;
if (fs.existsSync(jobsFile)) {
  const jobsData = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  const jobList = jobsData.jobs || [];
  hasCronFeishuDelivery = jobList.some(
    (j) =>
      j.delivery?.mode === 'announce' &&
      j.delivery?.channel === 'feishu' &&
      j.delivery?.to
  );
}
ok(
  '至少一条 cron 使用 feishu 投递',
  hasCronFeishuDelivery,
  hasCronFeishuDelivery ? 'ok' : 'jobs.json 中无 announce+feishu+to 的 job'
);

// 汇总
const failed = checks.filter((c) => !c.ok);
const passed = checks.filter((c) => c.ok);

console.log('\n--- heartbeat / announce 推送到飞书群 冒烟测试 ---\n');
checks.forEach((c) => {
  console.log(
    c.ok ? '  ✓' : '  ✗',
    c.name,
    c.message !== 'ok' ? `(${c.message})` : ''
  );
});
console.log('\n--- 结果 ---');
console.log(`通过: ${passed.length}, 失败: ${failed.length}`);
if (failed.length > 0) {
  console.log('失败项:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log(
  '配置就绪。实际投递需 Gateway 运行且模型调用成功；完整 E2E 可执行 cron run <id> 后查看规划群/饮食群或 gateway 日志。\n'
);
process.exit(0);
