#!/usr/bin/env node
/**
 * OpenClaw 更新提醒 + 项目扫描 + 与本项目相关的更新摘要
 *
 * 流程（均由本脚本主动完成，无需你手动拉取）：
 *   1. 从 npm 获取最新版本号
 *   2. 若有新版本，从 GitHub 拉取 release notes（先试 API，失败则从公开发布页 HTML 抓取）
 *   3. 扫描当前项目（.openclaw/config、cron 等）打标签
 *   4. 对比 release 条目与项目标签，输出「可能影响你的变更」与「与本项目相关的更新摘要」
 * 不执行更新，只输出报告；是否更新由你决定。GITHUB_TOKEN 可选（可提高 API 成功率）。
 *
 * 用法:
 *   node scripts/check-openclaw-update-with-relevance.js
 *   node scripts/check-openclaw-update-with-relevance.js --zh     # 相关条目输出为中文（机翻）
 *   node scripts/check-openclaw-update-with-relevance.js --json   # 机器可读
 *   OPENCLAW_PROJECT=/path node scripts/check-openclaw-update-with-relevance.js
 *
 * 建议：每周或每次想检查时手动跑一次；也可用 cron 定期跑并把输出写到文件或发到飞书。
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const projectRoot = process.env.OPENCLAW_PROJECT || path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, '.openclaw', 'config');
const cronPath = path.join(projectRoot, '.openclaw', 'state', 'cron', 'jobs.json');
const outJson = process.argv.includes('--json');
const outZh = process.argv.includes('--zh');
const writeReportArg = process.argv.find((a) => a.startsWith('--write-report='));
const writeReportPath = writeReportArg ? writeReportArg.slice('--write-report='.length).trim() : null;

function getCurrentVersion() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    return (config.meta && config.meta.lastTouchedVersion) || null;
  } catch (e) {
    return null;
  }
}

function getLatestVersion() {
  try {
    return execSync('npm view openclaw version', { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function scanProject() {
  const tags = new Set();
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return { tags: [], agentCount: 0, cronCount: 0 };
  }

  // 多 agent
  const list = config.agents && config.agents.list;
  if (Array.isArray(list)) {
    if (list.length > 1) tags.add('multi-agent');
    list.forEach((a) => {
      if (a.heartbeat && (a.heartbeat.every || a.heartbeat.target)) tags.add('heartbeat');
      if (a.channel === 'feishu' || (a.heartbeat && a.heartbeat.target === 'feishu')) tags.add('feishu');
    });
  }

  if (config.channels && config.channels.feishu) tags.add('feishu');
  const pe = config.plugins?.entries;
  const hasPlugins = pe && (Array.isArray(pe) ? pe.length : Object.keys(pe).length) > 0;
  if (config.plugins && (hasPlugins || Object.keys(config.plugins.slots || {}).length)) tags.add('plugins');
  if (config.models?.providers?.minimax) tags.add('minimax');
  if (config.models?.providers?.deepseek) tags.add('deepseek');
  if (config.models?.providers?.zai) tags.add('zai');

  let cronCount = 0;
  try {
    const jobs = JSON.parse(fs.readFileSync(cronPath, 'utf8'));
    cronCount = Array.isArray(jobs.jobs) ? jobs.jobs.length : 0;
    if (cronCount > 0) tags.add('cron');
  } catch (_) {}

  // MemOS / 记忆类
  const entries = config.plugins?.entries;
  const entryIds = Array.isArray(entries) ? entries.map((e) => (e.id || e).toString()) : (entries && typeof entries === 'object' ? Object.keys(entries) : []);
  if (entryIds.some((id) => id.toLowerCase().includes('memos'))) tags.add('memos');

  return {
    tags: Array.from(tags),
    agentCount: Array.isArray(list) ? list.length : 0,
    cronCount,
  };
}

function githubHeaders() {
  const h = { 'User-Agent': 'openclaw-update-check' };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = 'Bearer ' + token;
  return h;
}

function fetchReleases(perPage = 5) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: '/repos/openclaw/openclaw/releases?per_page=' + perPage,
      headers: githubHeaders(),
    };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (Array.isArray(data)) resolve(data);
          else if (data && Array.isArray(data.releases)) resolve(data.releases);
          else resolve([]);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fetchReleaseByTag(tag) {
  const t = tag.replace(/^v/, '') ? 'v' + tag.replace(/^v/, '') : tag;
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.github.com',
      path: '/repos/openclaw/openclaw/releases/tags/' + encodeURIComponent(t),
      headers: githubHeaders(),
    };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data && data.tag_name ? data : null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// 公开页面抓取：不依赖 API token，直接请求 GitHub 发布页 HTML 并解析出 release body
function fetchReleaseBodyFromPublicPage(tag) {
  const t = tag.replace(/^v/, '') ? 'v' + tag.replace(/^v/, '') : tag;
  return new Promise((resolve) => {
    const pathEnc = '/openclaw/openclaw/releases/tag/' + encodeURIComponent(t);
    const opts = {
      hostname: 'github.com',
      path: pathEnc,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const raw = body;
        let markdown = '';
        // 1) 尝试从嵌入的 application/json 里取 release.body（部分 GitHub 页面有）
        const jsonMatch = raw.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g);
        if (jsonMatch) {
          for (const block of jsonMatch) {
            const inner = block.replace(/<script[^>]*>|<\/script>/g, '');
            try {
              const json = JSON.parse(inner);
              const r = (json.payload && json.payload.release) || json.release;
              if (r && r.body) {
                markdown = r.body;
                break;
              }
            } catch (_) {}
          }
        }
        // 2) 否则从 HTML 中抽成“类 markdown”：把 <h3> 转成 ### ，<li> 转成 - ，保留换行供 parseBody 解析
        if (!markdown && (raw.includes('Highlight:') || raw.includes('Changes'))) {
          const strip = raw
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '');
          const fragment = strip.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, g) => '\n### ' + g.replace(/<[^>]+>/g, '').trim() + '\n');
          const withLi = fragment.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, g) => '\n- ' + g.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() + '\n');
          const text = withLi.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n[\n\s]+/g, '\n').trim();
          if (text.includes('###') || text.includes('- ')) markdown = text;
        }
        resolve(markdown || '');
      });
    }).on('error', () => resolve(''));
  });
}

// 从 release body 里拆成一条条；区分 Changes（亮点）与 Fixes（修复），便于做「本版核心亮点」块
function parseBody(body) {
  if (!body || typeof body !== 'string') return { all: [], changes: [], fixes: [] };
  const lines = body.split(/\r?\n/);
  const all = [];
  const changes = [];
  const fixes = [];
  let section = null; // 'changes' | 'fixes'
  for (const line of lines) {
    const t = line.trim();
    const h3 = t.match(/^###\s*(Changes|Fixes|Breaking)/i);
    if (h3) {
      section = /^###\s*Fixes/i.test(t) ? 'fixes' : 'changes';
      continue;
    }
    if (/^\-\s+/.test(t)) {
      const bullet = t.replace(/^\-\s+/, '');
      all.push(bullet);
      if (section === 'changes') changes.push(bullet);
      else if (section === 'fixes') fixes.push(bullet);
    }
  }
  return { all, changes, fixes };
}

// 根据项目 tags 给每条 note 打相关性（关键词匹配）
function relevance(note, tags) {
  const lower = note.toLowerCase();
  const tagLower = tags.map((t) => t.toLowerCase());
  let score = 0;
  const matched = [];
  if (tagLower.includes('heartbeat') && /heartbeat|cron.*isolated|delivery|message:sent/.test(lower)) {
    score += 2;
    matched.push('heartbeat');
  }
  if (tagLower.includes('feishu') && /feishu|飞书/.test(lower)) {
    score += 2;
    matched.push('feishu');
  }
  if (tagLower.includes('cron') && /cron|queue|drain|isolated|announce/.test(lower)) {
    score += 1;
    matched.push('cron');
  }
  if (tagLower.includes('plugins') && /plugin|config\.entries|plugins\.entries/.test(lower)) {
    score += 1;
    matched.push('plugins');
  }
  if (tagLower.includes('minimax') && /minimax|MiniMax/.test(lower)) {
    score += 1;
    matched.push('minimax');
  }
  if (/gateway|launchd|restart|daemon|supervisor/.test(lower)) {
    score += 1;
    matched.push('gateway');
  }
  if (/breaking|BREAKING|deprecat|remov\b|default.*change/.test(lower)) {
    score += 3;
    matched.push('breaking');
  }
  return { score, matched };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 英文 → 中文（MyMemory 免费 API，单条约 500 字内）
function translateToZhMyMemory(text) {
  const maxLen = 450;
  const toTranslate = text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  return new Promise((resolve) => {
    const p = '/get?q=' + encodeURIComponent(toTranslate) + '&langpair=en|zh-CN';
    const opts = { hostname: 'api.mymemory.translated.net', path: p, headers: { 'User-Agent': 'openclaw-update-check' } };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const t = data.responseData && data.responseData.translatedText;
          resolve(t && t !== toTranslate ? t : text);
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => resolve(text));
  });
}

// 英文 → 中文（DeepSeek API，项目已配 key 时优先使用）
function translateToZhDeepSeek(text) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return Promise.resolve(text);
  const maxLen = 2000;
  const toTranslate = text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '将以下英文翻译成简体中文，只输出翻译结果，不要解释：\n\n' + toTranslate }],
      max_tokens: 2048,
    });
    const opts = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          resolve(t ? String(t).trim() : text);
        } catch (e) {
          resolve(text);
        }
      });
    });
    req.on('error', () => resolve(text));
    req.write(body);
    req.end();
  });
}

async function translateBullets(bullets) {
  const useDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const translateOne = useDeepSeek ? translateToZhDeepSeek : (t) => translateToZhMyMemory(t);
  const out = [];
  for (let i = 0; i < bullets.length; i++) {
    const text = typeof bullets[i] === 'string' ? bullets[i] : bullets[i].text;
    const zh = await translateOne(text);
    out.push(typeof bullets[i] === 'string' ? zh : { ...bullets[i], textZh: zh });
    if (!useDeepSeek) await sleep(220);
    else await sleep(300);
  }
  return out;
}

// 用 DeepSeek 根据项目标签 + 变更条目，生成「与你相关」「本版核心亮点」「本版亮点」「更新后可选调整方案」（人话、好读、可执行）
function generateSummaryWithDeepSeek(projectTags, breakingEn, relevantEn, changeBullets) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return Promise.resolve(null);
  const tagsStr = projectTags.join('、');
  const breakingStr = breakingEn.slice(0, 5).join('\n');
  const relevantStr = relevantEn.slice(0, 12).join('\n');
  const coreSrc = (changeBullets || []).slice(0, 6).join('\n');
  const prompt = `你是一个 OpenClaw 更新报告助手。根据「当前项目使用的功能」和「本次 release 的变更条目」，生成一份简短、好读的中文总结，用于发到飞书群。

【当前项目使用的功能】
${tagsStr}

【本版官方 Changes 前几条（用于「本版核心亮点」区块，要逐条对应）】
${coreSrc || '（无）'}

【本次重大变更（Breaking）原文】
${breakingStr || '（无）'}

【与本项目相关的变更原文】
${relevantStr}

请严格按以下 JSON 输出，不要其他解释，不要 markdown 代码块包裹：
{
  "coreHighlights": [{"title": "4～8字短标题", "oneLine": "一句话说明好处或变化，人话、可带一点情绪"}],
  "forYou": ["2～3 条短句，说明「和你的项目有什么关系、为什么要关心这次更新」"],
  "highlights": ["3～5 条，和本项目更相关的亮点，每条一句话、人话、易读"],
  "afterUpdatePlan": ["3～6 条，更新后你可以做或可选的设置/调整，每条具体可执行。例如：无需改配置；或 若需控制 heartbeat 是否发私信，可在 config 中设置 agents.defaults.heartbeat.directPolicy；或 插件未知 id 现只告警不挡启动，可清理 config 里过时插件名"]
}

要求：
- coreHighlights：与上面「本版官方 Changes 前几条」逐条对应，每条一个对象。title 简短好记（如：API 密钥管理、多智能体线程、Codex 低延迟、一键绑定、安全漏洞修复）。oneLine 人话、可带一点「爽感」但不要夸张。
- forYou、highlights 用人话、不要技术黑话堆砌。afterUpdatePlan 要具体到「可以改哪个 config、做什么动作」，没有可做的就写「无需改配置」之类。`;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    });
    const opts = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const raw = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          if (!raw) {
            resolve(null);
            return;
          }
          let cleaned = raw.replace(/^```\w*\n?|```\s*$/g, '').trim();
          const first = cleaned.indexOf('{');
          if (first >= 0) cleaned = cleaned.slice(first);
          const last = cleaned.lastIndexOf('}');
          if (last > first) cleaned = cleaned.slice(0, last + 1);
          const parsed = JSON.parse(cleaned);
          const core = Array.isArray(parsed.coreHighlights) ? parsed.coreHighlights : [];
          resolve({
            coreHighlights: core.filter((x) => x && (x.title || x.oneLine)).map((x) => ({ title: x.title || '', oneLine: x.oneLine || '' })),
            forYou: Array.isArray(parsed.forYou) ? parsed.forYou : [],
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
            afterUpdatePlan: Array.isArray(parsed.afterUpdatePlan) ? parsed.afterUpdatePlan : [],
          });
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

function main() {
  const current = getCurrentVersion();
  const latest = getLatestVersion();
  const project = scanProject();

  if (!latest) {
    if (outJson) console.log(JSON.stringify({ error: 'Could not get latest version' }, null, 2));
    else console.log('无法获取最新版本（请检查 npm / 网络）');
    process.exit(1);
  }

  const currentNorm = (current || '0.0.0').replace(/^v/, '');
  const latestNorm = latest.replace(/^v/, '');
  const needSemver = (a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (vb > va) return true;
      if (vb < va) return false;
    }
    return false;
  };
  const hasNew = needSemver(currentNorm, latestNorm);

  const report = {
    currentVersion: current || 'unknown',
    latestVersion: latest,
    hasNew,
    project: {
      tags: project.tags,
      agentCount: project.agentCount,
      cronCount: project.cronCount,
    },
    relevantBullets: [],
    breakingBullets: [],
    releaseUrl: null,
  };

  if (!hasNew) {
    if (outJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log('当前已是最新：' + (current || 'unknown') + '（npm latest: ' + latest + '）');
    console.log('项目使用：' + project.tags.join(', ') + '；cron 数：' + project.cronCount + '，agent 数：' + project.agentCount);
    return;
  }

  Promise.resolve()
    .then(() => fetchReleases(5))
    .then(async (releases) => {
      const list = Array.isArray(releases) ? releases : [];
      let rel = list.find((r) => (r.tag_name || '').replace(/^v/, '') === latestNorm) || list[0];
      if (!rel && latestNorm) rel = await fetchReleaseByTag(latestNorm);
      // 若 API 未返回（如未配 token 被限流），由脚本主动从公开发布页抓取 release body
      if (!rel && latestNorm) {
        const tag = latestNorm.replace(/^v/, '') ? 'v' + latestNorm.replace(/^v/, '') : latestNorm;
        report.releaseUrl = 'https://github.com/openclaw/openclaw/releases/tag/' + tag;
        const bodyFromPage = await fetchReleaseBodyFromPublicPage(latestNorm);
        if (bodyFromPage) rel = { body: bodyFromPage, html_url: report.releaseUrl, tag_name: tag };
      }
      if (!rel) {
        report.releaseUrl = 'https://github.com/openclaw/openclaw/releases';
        if (outJson) console.log(JSON.stringify(report, null, 2));
        else console.log('当前：' + (current || 'unknown') + ' → 最新：' + latest + '\n发布页：' + report.releaseUrl + '\n（拉取 release 正文失败，请直接打开发布页查看）\n更新：openclaw update');
        return;
      }
      report.releaseUrl = report.releaseUrl || rel.html_url || 'https://github.com/openclaw/openclaw/releases';
      const parsed = parseBody(rel.body);
      const bullets = parsed.all;
      const changeBullets = parsed.changes || [];
      const withRelevance = bullets.map((b) => ({ text: b, ...relevance(b, project.tags) }));
      withRelevance.sort((a, b) => b.score - a.score);
      report.relevantBullets = withRelevance.filter((x) => x.score > 0 && !x.matched.includes('breaking')).slice(0, 15).map((x) => ({ match: x.matched, text: x.text }));
      report.breakingBullets = withRelevance.filter((x) => x.matched.includes('breaking')).slice(0, 10).map((x) => x.text);

      if (outJson) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      let breakingZh = report.breakingBullets;
      let relevantZh = report.relevantBullets;
      if (outZh && (report.breakingBullets.length > 0 || report.relevantBullets.length > 0)) {
        process.stderr.write(process.env.DEEPSEEK_API_KEY ? '正在用 DeepSeek 翻译并生成摘要…\n' : '正在机翻相关条目为中文…\n');
        if (report.breakingBullets.length > 0) breakingZh = await translateBullets(report.breakingBullets);
        if (report.relevantBullets.length > 0) relevantZh = await translateBullets(report.relevantBullets);
      }

      let summary = null;
      if (outZh && process.env.DEEPSEEK_API_KEY && (report.breakingBullets.length > 0 || report.relevantBullets.length > 0)) {
        process.stderr.write('正在生成「与你相关」与「更新后方案」…\n');
        summary = await generateSummaryWithDeepSeek(
          project.tags,
          report.breakingBullets,
          report.relevantBullets.map((x) => x.text),
          changeBullets
        );
      }

      const lines = [];
      function outLine(s) {
        lines.push(s);
        console.log(s);
      }
      function blank() {
        lines.push('');
        console.log('');
      }

      outLine('━━━ OpenClaw 更新提醒 ━━━');
      blank();
      outLine('当前版本：' + (current || 'unknown') + ' → 最新版本：' + latest);
      outLine('发布页：' + (report.releaseUrl || 'https://github.com/openclaw/openclaw/releases'));
      blank();

      if (summary && (summary.forYou.length > 0 || summary.highlights.length > 0 || summary.afterUpdatePlan.length > 0 || (summary.coreHighlights && summary.coreHighlights.length > 0))) {
        if (summary.forYou && summary.forYou.length > 0) {
          outLine('一、和你有什么关系');
          summary.forYou.forEach((t) => outLine('  • ' + t));
          blank();
        }
        if (summary.coreHighlights && summary.coreHighlights.length > 0) {
          outLine('二、本版核心亮点');
          summary.coreHighlights.forEach((c, i) => {
            const t = c.title ? (c.oneLine ? c.title + '：' + c.oneLine : c.title) : c.oneLine;
            if (t) outLine('  ' + (i + 1) + '. ' + t);
          });
          blank();
        }
        if (summary.highlights && summary.highlights.length > 0) {
          outLine('三、和你更相关的几点');
          summary.highlights.forEach((t) => outLine('  • ' + t));
          blank();
        }
        if (breakingZh.length > 0) {
          outLine('四、重大变更（必看）');
          breakingZh.forEach((t) => outLine('  • ' + (typeof t === 'string' ? t : t.textZh || t)));
          blank();
        }
        if (summary.afterUpdatePlan && summary.afterUpdatePlan.length > 0) {
          outLine('五、更新后你可以做的设置/调整');
          summary.afterUpdatePlan.forEach((t) => outLine('  • ' + t));
          blank();
        }
        outLine('六、详细相关条目（可略读）');
        if (relevantZh.length > 0) {
          relevantZh.slice(0, 6).forEach((item) => {
            const text = typeof item === 'string' ? item : (item.textZh != null ? item.textZh : item.text);
            outLine('  · ' + (text.length > 120 ? text.slice(0, 120) + '…' : text));
          });
          if (relevantZh.length > 6) outLine('  … 共 ' + relevantZh.length + ' 条，完整见报告文件');
        } else {
          outLine('  （无）');
        }
        blank();
      } else {
        outLine('一、和你有什么关系');
        outLine('  本项目用了：' + project.tags.join('、') + '；以下变更与这些功能相关。');
        blank();
        if (changeBullets.length > 0) {
          outLine('二、本版核心亮点');
          changeBullets.slice(0, 6).forEach((b, i) => outLine('  ' + (i + 1) + '. ' + (b.length > 78 ? b.slice(0, 78) + '…' : b)));
          blank();
        }
        if (breakingZh.length > 0) {
          outLine(changeBullets.length > 0 ? '三、重大变更（必看）' : '二、重大变更（必看）');
          breakingZh.forEach((t) => outLine('  • ' + (typeof t === 'string' ? t : t.textZh || t)));
          blank();
        }
        outLine(changeBullets.length > 0 ? '四、相关条目（精选）' : '三、相关条目（精选）');
        if (relevantZh.length > 0) {
          relevantZh.slice(0, 5).forEach((item) => {
            const text = typeof item === 'string' ? item : (item.textZh != null ? item.textZh : item.text);
            outLine('  • ' + (text.length > 100 ? text.slice(0, 100) + '…' : text));
          });
        } else {
          outLine('  （建议直接看发布页）');
        }
        blank();
        outLine(changeBullets.length > 0 ? '五、更新后你可以做的设置/调整' : '四、更新后你可以做的设置/调整');
        outLine('  更新后若需细调，可查看 config 中 heartbeat、cron、plugins 相关项；本次多为修复与优化，一般无需改配置。');
        blank();
      }

      outLine('─────────────────────');
      outLine('更新：openclaw update  或  openclaw update --dry-run 先预览');
      outLine('在脑暴群发新消息说「确认更新」并 @ 机器人将执行 openclaw update（勿用「回复」某条，否则可能接到 main 不执行）。');

      if (writeReportPath) {
        try {
          const dir = path.dirname(writeReportPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(writeReportPath, lines.join('\n'), 'utf8');
        } catch (e) {
          process.stderr.write('写入报告文件失败: ' + e.message + '\n');
        }
      }
    })
    .catch((err) => {
      if (outJson) console.log(JSON.stringify({ error: err.message, hasNew, currentVersion: current, latestVersion: latest }, null, 2));
      else console.log('获取 release notes 失败：' + err.message + '\n仍有新版本：' + latest + '，请查看 https://github.com/openclaw/openclaw/releases');
      process.exit(1);
    });
}

main();
