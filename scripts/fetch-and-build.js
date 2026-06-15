const https = require('https');
const fs = require('fs');
const path = require('path');

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const CATEGORIES = ['politics', 'economy', 'finance', 'military', 'energy'];

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
  // 只拉取当天的新闻
  const today = new Date();
  const fromDate = today.toISOString().split('T')[0];

  for (const category of CATEGORIES) {
    const queries = buildQueries(category);
    for (const q of queries) {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${fromDate}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWSAPI_KEY}`;
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

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const url = new URL(DEEPSEEK_BASE.replace(/\/+$/, '') + '/v1/chat/completions');
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
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`DeepSeek API error: ${res.statusCode} ${data.slice(0, 200)}`));
            return;
          }
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
  const prompt = `请完成以下任务：

1. 将新闻标题翻译成中文（简洁准确）
2. 从以下两个角度深入分析这条新闻（每条分析200-300字）：

【新闻标题】${article.title}
【来源】${article.source}
【摘要】${article.description}

第一性原理分析：回归事件最底层的因果关系，剥离表象看本质。
贝叶斯分析：基于先验概率更新后验判断，评估事件对未来的影响。

请用以下格式回复（只输出JSON，不要其他内容）：
{"titleCN":"中文标题","firstPrinciples":"第一性原理分析内容","bayesian":"贝叶斯分析内容"}`;

  try {
    const response = await callDeepSeek([
      { role: 'user', content: prompt }
    ]);
    const parsed = JSON.parse(response);
    return {
      titleCN: parsed.titleCN || article.title,
      firstPrinciples: parsed.firstPrinciples || '分析暂时不可用',
      bayesian: parsed.bayesian || '分析暂时不可用',
    };
  } catch (e) {
    console.error(`Analysis failed for "${article.title.slice(0, 30)}...":`, e.message);
    return {
      titleCN: article.title,
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
      items[i].titleCN = analysis.titleCN;
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
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found: ${TEMPLATE_PATH}`);
    process.exit(1);
  }
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
      contentHTML += `  <p class="title">${escapeHTML(a.titleCN || a.title)}</p>\n`;
      contentHTML += `  <p class="meta">原文：${escapeHTML(a.title)}</p>\n`;
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
  const bjTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const updateTime = `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')} ${String(bjTime.getHours()).padStart(2, '0')}:${String(bjTime.getMinutes()).padStart(2, '0')} (北京时间)`;

  const html = template.replaceAll('{{CONTENT}}', contentHTML).replaceAll('{{UPDATE_TIME}}', updateTime);
  fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
  console.log(`Generated: ${OUTPUT_PATH} (${(html.length / 1024).toFixed(1)} KB)`);
}

function escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
