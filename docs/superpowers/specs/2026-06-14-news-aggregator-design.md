# 全球新闻深度分析聚合器 — 设计文档

## 概述

每天北京时间 06:00 自动拉取中国、美国、俄罗斯、欧盟、英国主流媒体的政治/经济/金融/军事/能源新闻，每类取 TOP 3，每条提供第一性原理和贝叶斯分析。

## 技术选型

| 组件 | 选型 | 理由 |
|---|---|---|
| 新闻获取 | NewsAPI | 不消耗 token，返回标题/摘要/来源/URL |
| AI 分析 | DeepSeek API（已有 token） | 每天 15 条 × 200-300 字 ≈ 6k-10k token |
| 定时触发 | GitHub Actions cron `0 22 * * *` (UTC) | 对应北京时间 06:00，免费额度充足 |
| 部署 | Vercel 静态托管 | 免费，GitHub 推送自动部署 |
| 网页 | 单文件 HTML（内嵌 CSS/JS） | 零依赖，最小化 |

## 架构

```
GitHub Actions (每天 06:00 BJT)
  → Node.js 脚本
    → 1. NewsAPI 拉取 5 类 × 各国新闻
    → 2. 按来源权威度排序，每类取 TOP 3
    → 3. DeepSeek API 逐条分析
    → 4. 生成单文件 index.html
    → 5. git commit + push
  → Vercel 自动部署
```

## 页面结构

单页面，自上而下：

```
[标题] 全球新闻深度分析 · 更新时间
[导航] 政治 | 经济 | 金融 | 军事 | 能源 （锚点跳转）

[政治]
  #1 新闻标题 · 来源 · 原文链接
     第一性原理分析  |  贝叶斯分析
  #2 ...
  #3 ...

[经济]
  ...

[页脚] 每天北京时间 06:00 自动更新
```

## 数据模型

每条新闻：
```json
{
  "title": "标题",
  "source": "Reuters",
  "url": "原文链接",
  "category": "politics",
  "rank": 1,
  "firstPrinciples": "第一性原理分析...",
  "bayesianAnalysis": "贝叶斯分析...",
  "fetchedAt": "2026-06-14T06:00:00+08:00"
}
```

## 排序规则

按来源权威度加权排序：
- Tier 1（权重 3）：Reuters, AP, AFP, Xinhua, BBC, TASS
- Tier 2（权重 2）：CNN, NYT, Guardian, RT, France24, DW
- Tier 3（权重 1）：其他 NewsAPI 收录媒体

## 环境变量

| 变量 | 用途 |
|---|---|
| `NEWSAPI_KEY` | NewsAPI 调用 |
| `DEEPSEEK_API_KEY` | DeepSeek 分析 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |

## 需要用户准备

1. GitHub 账号 ✅ 已有
2. NewsAPI Key ✅ 已获取
3. DeepSeek API Token ✅ 已有
4. Vercel 账号 — 用 GitHub 一键注册
