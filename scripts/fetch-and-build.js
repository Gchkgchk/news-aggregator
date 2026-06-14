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
