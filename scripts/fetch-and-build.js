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
  for (const category of CATEGORIES) {
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
