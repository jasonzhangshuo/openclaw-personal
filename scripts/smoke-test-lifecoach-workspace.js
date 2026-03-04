#!/usr/bin/env node
/**
 * 冒烟测试：lifecoach workspace 重构后 SOUL / AGENTS / Skill / HEARTBEAT 一致性与存在性
 * 用法: node scripts/smoke-test-lifecoach-workspace.js
 * 从项目根或指定 OPENCLAW_PROJECT 目录执行
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.env.OPENCLAW_PROJECT || path.resolve(__dirname, '..');
const workspace = path.join(projectRoot, '.openclaw', 'workspace-lifecoach');

const checks = [];
function ok(name, condition, message) {
  checks.push({ name, ok: !!condition, message: message || (condition ? 'ok' : 'fail') });
}

// 1. 文件存在且非空
const files = {
  SOUL: path.join(workspace, 'SOUL.md'),
  AGENTS: path.join(workspace, 'AGENTS.md'),
  HEARTBEAT: path.join(workspace, 'HEARTBEAT.md'),
  Skill: path.join(workspace, 'skills', 'life-schedule-coach', 'SKILL.md'),
};

for (const [label, filePath] of Object.entries(files)) {
  const exists = fs.existsSync(filePath);
  ok(`${label} 存在`, exists, exists ? 'ok' : `文件不存在: ${filePath}`);
  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    ok(`${label} 非空`, content.length > 100, content.length > 100 ? 'ok' : '文件过短或为空');
  }
}

// 2. SOUL 引用 Skill 与 HEARTBEAT（不包含具体步骤与路径）
const soul = fs.readFileSync(files.SOUL, 'utf8');
ok('SOUL 引用 Skill', soul.includes('skills/life-schedule-coach/SKILL.md') || soul.includes('life-schedule-coach'), 'ok');
ok('SOUL 引用 HEARTBEAT', soul.includes('HEARTBEAT.md'), 'ok');
ok('SOUL 无旧 personalOS 落盘路径', !soul.includes('/Users/zhangshuo/personalOS/data/tomorrow_plan/'), 'SOUL 不应再包含旧 personalOS 路径');

// 3. AGENTS 触发读 Skill 的条件包含 cron 与更新计划
const agents = fs.readFileSync(files.AGENTS, 'utf8');
ok('AGENTS 要求先读 Skill', agents.includes('skills/life-schedule-coach/SKILL.md'), 'ok');
ok('AGENTS 含 cron 触发', agents.includes('请生成明日动态计划') || agents.includes('23:00'), 'ok');
ok('AGENTS 含更新计划触发', agents.includes('tomorrow_plan') || agents.includes('修改某日计划'), 'ok');
ok('AGENTS task_events 指向第五节', agents.includes('第五节'), 'ok');

// 4. Skill 含计划生成与落盘、绝对路径、2.1/2.2/2.3、五/六节
const skill = fs.readFileSync(files.Skill, 'utf8');
ok('Skill 含「二、计划生成与落盘」', skill.includes('二、计划生成与落盘'), 'ok');
ok('Skill 含 2.1 每晚 23:00', skill.includes('2.1') && skill.includes('23:00'), 'ok');
ok('Skill 含 2.2 今天的计划', skill.includes('2.2') && skill.includes('今天'), 'ok');
ok('Skill 含 2.3 用户修改后写回', skill.includes('2.3') && skill.includes('写回'), 'ok');
ok(
  'Skill 含 workspace 内绝对路径约定',
  skill.includes('/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/'),
  'ok'
);
ok('Skill 含「五、同步到 task_events」', skill.includes('五、同步到 task_events'), 'ok');
ok('Skill 含「六、边界」', skill.includes('六、边界'), 'ok');
ok('Skill 禁止相对路径', skill.includes('禁止') && skill.includes('相对路径'), 'ok');

// 5. HEARTBEAT 含 tomorrow_plan 与 daily_summary 路径（与 Skill 一致）
const heartbeat = fs.readFileSync(files.HEARTBEAT, 'utf8');
ok(
  'HEARTBEAT 含 workspace tomorrow_plan 路径',
  heartbeat.includes('/Users/zhangshuo/openclawxitong/.openclaw/workspace-lifecoach/data/tomorrow_plan/'),
  'ok'
);
ok('HEARTBEAT 含 daily_summary', heartbeat.includes('daily_summary'), 'ok');

// 汇总
const failed = checks.filter((c) => !c.ok);
const passed = checks.filter((c) => c.ok);

console.log('\n--- lifecoach workspace 冒烟测试 ---\n');
checks.forEach((c) => {
  console.log(c.ok ? '  ✓' : '  ✗', c.name, c.message !== 'ok' ? `(${c.message})` : '');
});
console.log('\n--- 结果 ---');
console.log(`通过: ${passed.length}, 失败: ${failed.length}`);
if (failed.length > 0) {
  console.log('失败项:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('冒烟测试通过。\n');
process.exit(0);
