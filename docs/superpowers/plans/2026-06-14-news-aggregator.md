# 全球新闻深度分析聚合器 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个每天北京时间 06:00 自动更新的新闻聚合网页，拉取多国主流媒体新闻，按类别展示 TOP 3，并提供 AI 深度分析。

**Architecture:** GitHub Actions 每天定时触发 Node.js 脚本 → 从 NewsAPI 拉取 5 类新闻 → 按来源权威度排序取 TOP 3 → 调用 DeepSeek API 逐条分析 → 生成单文件 index.html → 推送到 GitHub → Vercel 自动部署。

**Tech Stack:** Node.js, NewsAPI, DeepSeek API, GitHub Actions, Vercel

---

## File Structure

```
/Users/chenkaigong/Documents/test1/
├── package.json              # 项目配置，依赖声明
├── .gitignore                # 忽略 node_modules, .env
├── .env.example              # 环境变量模板
├── scripts/
│   ├── fetch-and-build.js    # 主脚本：拉取新闻 + AI分析 + 生成HTML
│   └── template.html         # HTML 模板（内容占位符）
├── .github/
│   └── workflows/
│       └── daily-update.yml  # GitHub Actions 定时触发
└── index.html                # 生成的网页（脚本自动产出）
```

---

### Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: 创建 package.json**

```bash
cd /Users/chenkaigong/Documents/test1
npm init -y
```

- [ ] **Step 2: 写入 package.json**

```json
{
  "name": "news-aggregator",
  "version": "1.0.0",
  "description": "全球新闻深度分析聚合器",
  "private": true,
  "scripts": {
    "build": "node scripts/fetch-and-build.js"
  }
}
```

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
.env
```

- [ ] **Step 4: 创建 .env.example**

```
NEWSAPI_KEY=your_newsapi_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

- [ ] **Step 5: Commit**

```bash
git init
git add package.json .gitignore .env.example
git commit -m "chore: init project"
```

---

### Task 2: HTML 模板

**Files:**
- Create: `scripts/template.html`

- [ ] **Step 1: 创建 HTML 模板**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>全球新闻深度分析</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f5;color:#333;line-height:1.6}
.container{max-width:900px;margin:0 auto;padding:20px}
header{text-align:center;padding:24px 0;border-bottom:2px solid #e0e0e0;margin-bottom:24px}
header h1{font-size:24px;margin-bottom:4px}
header .update-time{font-size:13px;color:#888}
nav{display:flex;gap:0;margin-bottom:24px;border-radius:8px;overflow:hidden}
nav a{flex:1;text-align:center;padding:10px 0;text-decoration:none;font-size:14px;font-weight:600;background:#e8e8e8;color:#555;transition:background .2s}
nav a:hover{background:#d0d0d0}
.category{margin-bottom:32px}
.category-title{font-size:20px;font-weight:700;padding-bottom:8px;border-bottom:2px solid #1a1a2e;margin-bottom:16px}
.news-item{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.news-item .rank{display:inline-block;background:#1a1a2e;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:8px}
.news-item .title{font-size:17px;font-weight:700;margin:8px 0 4px}
.news-item .meta{font-size:12px;color:#888;margin-bottom:12px}
.news-item .meta a{color:#1a73e8;text-decoration:none}
.analysis{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.analysis-box{padding:12px;border-radius:6px;font-size:13px;line-height:1.7}
.analysis-box.first-principles{background:#fef9f0;border-left:3px solid #e67e22}
.analysis-box.bayesian{background:#f0f4ff;border-left:3px solid #3498db}
.analysis-box h4{font-size:13px;margin-bottom:4px}
footer{text-align:center;padding:24px 0;color:#aaa;font-size:12px;border-top:1px solid #e0e0e0;margin-top:32px}
@media(max-width:600px){.analysis{grid-template-columns:1fr}nav{flex-wrap:wrap}}
</style>
</head>
<body>
<div class="container">
<header>
  <h1>🌍 全球新闻深度分析</h1>
  <p class="update-time">更新于 {{UPDATE_TIME}}</p>
</header>
<nav>
  <a href="#politics">政治</a>
  <a href="#economy">经济</a>
  <a href="#finance">金融</a>
  <a href="#military">军事</a>
  <a href="#energy">能源</a>
</nav>
{{CONTENT}}
<footer>每天北京时间 06:00 自动更新 · 新闻来源：各国主流媒体 · AI 分析仅供参考</footer>
</div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/template.html
git commit -m "feat: add HTML template"
```

---

### Task 3: 主脚本 — 拉取新闻

**Files:**
- Create: `scripts/fetch-and-build.js`

- [ ] **Step 1: 写 NewsAPI 拉取逻辑**

```javascript
const https = require('https');
const fs = require('fs');
const path = require('path');

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const CATEGORIES = ['politics', 'economy', 'finance', 'military', 'energy'];
const COUNTRIES = [
  { code: 'cn', name: '中国' },
  { code: 'us', name: '美国' },
  { code: 'ru', name: '俄罗斯' },
  { code: 'eu', name: '欧盟' },
  { code: 'gb', name: '英国' },
];

// 来源权威度权重
const SOURCE_TIERS = {
  tier1: { weight: 3, sources: ['reuters', 'associated-press', 'afp', 'xinhua', 'bbc-news', 'tass'] },
  tier2: { weight: 2, sources: ['cnn', 'the-new-york-times', 'the-guardian-uk', 'rt', 'france-24', 'deutsche-welle'] },
  tier3: { weight: 1, sources: [] }, // fallback
};

function getSourceWeight(sourceId) {
  if (SOURCE_TIERS.tier1.sources.includes(sourceId)) return SOURCE_TIERS.tier1.weight;
  if (SOURCE_TIERS.tier2.sources.includes(sourceId)) return SOURCE_TIERS.tier2.weight;
  return SOURCE_TIERS.tier3.weight;
}

function fetchNewsAPI(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NewsAggregator/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchAllNews() {
  const allNews = [];
  for (const category of CATEGORIES) {
    // 每个类别搜索相关关键词
    const queries = buildQueries(category);
    for (const q of queries) {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=popularity&pageSize=20&apiKey=${NEWSAPI_KEY}`;
      try {
        const result = await fetchNewsAPI(url);
        if (result.status === 'ok') {
          for (const article of result.articles) {
            allNews.push({
              title: article.title,
              source: article.source.name,
              sourceId: article.source.id,
              url: article.url,
              category: category,
              publishedAt: article.publishedAt,
              description: article.description || '',
            });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch ${q}:`, e.message);
      }
    }
  }
  return allNews;
}

function buildQueries(category) {
  const keywordMap = {
    politics: ['diplomacy', 'election', 'government', 'parliament', 'geopolitics'],
    economy: ['economy', 'GDP', 'trade', 'inflation', 'economic growth'],
    finance: ['stock market', 'central bank', 'interest rate', 'currency', 'financial regulation'],
    military: ['military', 'defense', 'navy', 'air force', 'weapon'],
    energy: ['oil', 'gas', 'renewable energy', 'nuclear', 'OPEC'],
  };
  return keywordMap[category] || [category];
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch-and-build.js
git commit -m "feat: add NewsAPI fetch logic"
```

---

### Task 4: 主脚本 — 排序与筛选

**Files:**
- Modify: `scripts/fetch-and-build.js` — 追加以下代码

- [ ] **Step 1: 添加排序筛选逻辑**

```javascript
function sortAndFilter(news) {
  const categorized = {};
  for (const cat of CATEGORIES) {
    categorized[cat] = [];
  }

  for (const item of news) {
    const cat = item.category;
    if (!categorized[cat]) categorized[cat] = [];
    item.weight = getSourceWeight(item.sourceId);
    categorized[cat].push(item);
  }

  // 每类按权重降序排列，取 TOP 3
  const result = {};
  for (const cat of CATEGORIES) {
    categorized[cat].sort((a, b) => b.weight - a.weight);
    // 去重（同标题只保留权重最高的）
    const seen = new Set();
    const deduped = [];
    for (const item of categorized[cat]) {
      const key = item.title.slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }
    result[cat] = deduped.slice(0, 3);
  }
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch-and-build.js
git commit -m "feat: add sort and filter logic"
```

---

### Task 5: 主脚本 — DeepSeek AI 分析

**Files:**
- Modify: `scripts/fetch-and-build.js` — 追加以下代码

- [ ] **Step 1: 添加 DeepSeek API 调用函数**

```javascript
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const url = new URL(DEEPSEEK_BASE + '/v1/chat/completions');
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      max_tokens: 600,
      temperature: 0.7,
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.choices[0].message.content);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function analyzeNews(article) {
  const prompt = `请从以下两个角度深入分析这条新闻（每条分析200-300字）：

【新闻标题】${article.title}
【来源】${article.source}
【摘要】${article.description}

1. 第一性原理分析：回归事件最底层的因果关系，剥离表象看本质。
2. 贝叶斯分析：基于先验概率更新后验判断，评估事件对未来的影响。

请用以下格式回复（只输出JSON）：
{"firstPrinciples":"第一性原理分析内容","bayesian":"贝叶斯分析内容"}`;

  try {
    const response = await callDeepSeek([
      { role: 'user', content: prompt }
    ]);
    const parsed = JSON.parse(response);
    return {
      firstPrinciples: parsed.firstPrinciples || '分析暂时不可用',
      bayesian: parsed.bayesian || '分析暂时不可用',
    };
  } catch (e) {
    console.error(`Analysis failed for "${article.title.slice(0, 30)}...":`, e.message);
    return {
      firstPrinciples: '分析暂时不可用，请稍后刷新。',
      bayesian: '分析暂时不可用，请稍后刷新。',
    };
  }
}

async function analyzeAll(newsByCategory) {
  for (const cat of CATEGORIES) {
    const items = newsByCategory[cat] || [];
    for (let i = 0; i < items.length; i++) {
      console.log(`Analyzing: [${cat}] #${i + 1} ${items[i].title.slice(0, 40)}...`);
      const analysis = await analyzeNews(items[i]);
      items[i].firstPrinciples = analysis.firstPrinciples;
      items[i].bayesian = analysis.bayesian;
      // 避免请求过快
      await sleep(1000);
    }
  }
  return newsByCategory;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch-and-build.js
git commit -m "feat: add DeepSeek AI analysis"
```

---

### Task 6: 主脚本 — HTML 生成与入口

**Files:**
- Modify: `scripts/fetch-and-build.js` — 追加以下代码

- [ ] **Step 1: 添加 HTML 生成和 main 入口**

```javascript
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const OUTPUT_PATH = path.join(__dirname, '..', 'index.html');

const CATEGORY_NAMES = {
  politics: '政治',
  economy: '经济',
  finance: '金融',
  military: '军事',
  energy: '能源',
};

function renderHTML(newsByCategory) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  let contentHTML = '';
  for (const cat of CATEGORIES) {
    const items = newsByCategory[cat] || [];
    contentHTML += `<section id="${cat}" class="category">\n`;
    contentHTML += `<h2 class="category-title">${CATEGORY_NAMES[cat]}</h2>\n`;

    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      contentHTML += `<div class="news-item">\n`;
      contentHTML += `  <span class="rank">#${i + 1}</span>\n`;
      contentHTML += `  <p class="title">${escapeHTML(a.title)}</p>\n`;
      contentHTML += `  <p class="meta">来源：${escapeHTML(a.source)} · <a href="${escapeHTML(a.url)}" target="_blank" rel="noopener">阅读原文 →</a></p>\n`;
      contentHTML += `  <div class="analysis">\n`;
      contentHTML += `    <div class="analysis-box first-principles"><h4>🔍 第一性原理分析</h4><p>${escapeHTML(a.firstPrinciples || '')}</p></div>\n`;
      contentHTML += `    <div class="analysis-box bayesian"><h4>📊 贝叶斯分析</h4><p>${escapeHTML(a.bayesian || '')}</p></div>\n`;
      contentHTML += `  </div>\n`;
      contentHTML += `</div>\n`;
    }
    contentHTML += `</section>\n`;
  }

  const now = new Date();
  const updateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (北京时间)`;

  const html = template.replace('{{CONTENT}}', contentHTML).replace('{{UPDATE_TIME}}', updateTime);
  fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
  console.log(`Generated: ${OUTPUT_PATH} (${(html.length / 1024).toFixed(1)} KB)`);
}

function escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  if (!NEWSAPI_KEY) { console.error('Missing NEWSAPI_KEY'); process.exit(1); }
  if (!DEEPSEEK_KEY) { console.error('Missing DEEPSEEK_API_KEY'); process.exit(1); }

  console.log('=== Step 1: Fetching news ===');
  const allNews = await fetchAllNews();
  console.log(`Fetched ${allNews.length} articles`);

  console.log('=== Step 2: Sorting & filtering ===');
  const sorted = sortAndFilter(allNews);
  const total = Object.values(sorted).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Selected ${total} articles (top 3 per category)`);

  console.log('=== Step 3: AI analysis ===');
  const analyzed = await analyzeAll(sorted);

  console.log('=== Step 4: Generating HTML ===');
  renderHTML(analyzed);

  console.log('=== Done ===');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch-and-build.js
git commit -m "feat: add HTML generation and main entry"
```

---

### Task 7: GitHub Actions 定时工作流

**Files:**
- Create: `.github/workflows/daily-update.yml`

- [ ] **Step 1: 创建工作流文件**

```yaml
name: Daily News Update

on:
  schedule:
    # 每天 UTC 22:00 = 北京时间 06:00
    - cron: '0 22 * * *'
  workflow_dispatch:  # 允许手动触发

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run fetch script
        env:
          NEWSAPI_KEY: ${{ secrets.NEWSAPI_KEY }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          DEEPSEEK_BASE_URL: ${{ secrets.DEEPSEEK_BASE_URL }}
        run: node scripts/fetch-and-build.js

      - name: Commit and push if changed
        run: |
          git config user.name "News Bot"
          git config user.email "bot@news.local"
          git add index.html
          if git diff --staged --quiet; then
            echo "No changes, skipping commit"
          else
            git commit -m "auto: daily news update $(date +%Y-%m-%d)"
            git push
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/daily-update.yml
git commit -m "feat: add GitHub Actions daily workflow"
```

---

### Task 8: 本地测试

**Files:**
- Modify: `.env`（已有 NEWSAPI_KEY）

- [ ] **Step 1: 确保 .env 包含 DeepSeek key**

`.env` 文件应为：
```
NEWSAPI_KEY=49e1afa906394ff297e87aa224d07d79
DEEPSEEK_API_KEY=sk-dc44688701ea4d4797c963ac86155d9f
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

- [ ] **Step 2: 本地运行测试**

```bash
cd /Users/chenkaigong/Documents/test1
source .env
NEWSAPI_KEY=$NEWSAPI_KEY DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY node scripts/fetch-and-build.js
```

- [ ] **Step 3: 验证输出**

打开 `index.html` 在浏览器查看，确认：
- 5 个分类都有内容
- 每类显示 TOP 3
- 每条新闻有第一性原理和贝叶斯分析
- 导航锚点跳转正常
- 移动端自适应正常

- [ ] **Step 4: 如有问题修复后 commit**

---

### Task 9: Vercel 部署

**不需要写代码，手动操作：**

- [ ] **Step 1: 推送代码到 GitHub**

```bash
cd /Users/chenkaigong/Documents/test1
git remote add origin <你的 GitHub 仓库 URL>
git branch -M main
git push -u origin main
```

- [ ] **Step 2: 注册 Vercel**

打开 https://vercel.com，用 GitHub 账号登录。

- [ ] **Step 3: 导入项目**

点击 "New Project" → 选择你的 GitHub 仓库 → 直接 Deploy（不需要改配置）。

- [ ] **Step 4: 配置 GitHub Secrets**

在 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：
- `NEWSAPI_KEY` = `49e1afa906394ff297e87aa224d07d79`
- `DEEPSEEK_API_KEY` = `sk-dc44688701ea4d4797c963ac86155d9f`
- `DEEPSEEK_BASE_URL` = `https://api.deepseek.com`

- [ ] **Step 5: 手动触发测试**

GitHub Actions 页面 → Daily News Update → Run workflow → 等待执行完 → 打开 Vercel 分配的域名验证。

---

## 验证清单

- [ ] `node scripts/fetch-and-build.js` 本地跑通
- [ ] `index.html` 浏览器打开正常显示
- [ ] GitHub Actions 定时 + 手动触发均正常
- [ ] Vercel 自动部署生效
- [ ] 移动端页面可读
