import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/schema.js';
import { deepResearchCompetitor, ExaResearchResult } from './exa-research.js';

interface ScrapedData {
  snapshotId: string;
  url: string;
  title: string;
  textContent: string;
  pricing: PricingData[];
  features: string[];
  metaDescription: string;
  heroText: string;
  ctaText: string[];
  testimonials: string[];
  changelog: string;
  searchResults: string;
  reviews?: Array<{ source: string; text: string; rating?: number }>;
  news?: Array<{ title: string; text: string; date: string }>;
  techStack?: string[];
  fundingInfo?: string;
  competitorMentions?: Array<{ url: string; text: string }>;
  employeeCount?: string;
  allSearchText?: string;
}

interface PricingData {
  tier: string;
  price: string;
  features: string[];
  isPopular: boolean;
}

const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
];

function getHeaders() {
  return {
    'User-Agent': UA_LIST[Math.floor(Math.random() * UA_LIST.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
  };
}

async function searchGoogle(query: string): Promise<string> {
  const results: string[] = [];
  try {
    const resp = await axios.get('https://www.google.com/search', {
      params: { q: query, num: 10, hl: 'en' },
      headers: { ...getHeaders(), 'User-Agent': UA_LIST[0] },
      timeout: 12000,
    });
    const $ = cheerio.load(resp.data);
    $('div.g, div[data-sokoban-container]').each((_, el) => {
      const title = $(el).find('h3').first().text().trim();
      const snippet = $(el).find('div[data-sncf], div.VwiC3b, span.aCOpRe').first().text().trim();
      const link = $(el).find('a').first().attr('href') || '';
      if (title && snippet) {
        results.push(`[${title}] ${snippet}`);
      }
    });
  } catch {}
  return results.join('\n');
}

async function searchBing(query: string): Promise<string> {
  const results: string[] = [];
  try {
    const resp = await axios.get('https://www.bing.com/search', {
      params: { q: query, count: 10 },
      headers: getHeaders(),
      timeout: 12000,
    });
    const $ = cheerio.load(resp.data);
    $('li.b_algo').each((_, el) => {
      const title = $(el).find('h2').first().text().trim();
      const snippet = $(el).find('div.b_caption p, p').first().text().trim();
      if (title && snippet && snippet.length > 20) {
        results.push(`[${title}] ${snippet}`);
      }
    });
  } catch {}
  return results.join('\n');
}

async function searchCompetitorIntelligence(domain: string, companyName: string): Promise<string> {
  console.log(`[Search] Researching ${companyName}...`);

  const queries = [
    `${companyName} pricing plans cost 2024 2025`,
    `${companyName} review comparison vs alternatives`,
    `${companyName} features changelog updates`,
    `${companyName} customers users funding valuation`,
    `site:g2.com OR site:capterra.com OR site:trustpilot.com ${companyName}`,
  ];

  let allResults = '';

  for (const q of queries) {
    const googleResults = await searchGoogle(q);
    const bingResults = await searchBing(q);

    if (googleResults) allResults += `\n--- Google: ${q} ---\n${googleResults}\n`;
    if (bingResults) allResults += `\n--- Bing: ${q} ---\n${bingResults}\n`;

    await new Promise(r => setTimeout(r, 800));
  }

  return allResults.trim();
}

async function scrapePage(url: string): Promise<{ text: string; html: string; title: string; meta: string; pricing: PricingData[]; features: string[]; hero: string; ctas: string[]; testimonials: string[]; changelog: string }> {
  let text = '', html = '', title = '', meta = '', hero = '';
  let pricing: PricingData[] = [], features: string[] = [], ctas: string[] = [], testimonials: string[] = [], changelog = '';

  try {
    const resp = await axios.get(url, { headers: getHeaders(), timeout: 15000, maxRedirects: 5 });
    html = resp.data;
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe').remove();
    text = $('body').text().replace(/\s+/g, ' ').trim();
    title = $('title').text().trim() || $('h1').first().text().trim();
    meta = $('meta[name="description"]').attr('content') || '';
    hero = $('h1').first().text().trim() || $('h2').first().text().trim();

    $('[class*="pricing"], [class*="plan"], [class*="tier"], [data-pricing]').each((_, el) => {
      const tier = $(el).find('h2, h3, h4, [class*="name"], [class*="title"]').first().text().trim();
      const price = $(el).find('[class*="price"], [class*="amount"], [class*="cost"]').first().text().trim();
      const isPopular = $(el).hasClass('popular') || $(el).find('[class*="popular"], [class*="recommended"]').length > 0;
      const feats: string[] = [];
      $(el).find('li').each((_, f) => { const t = $(f).text().trim(); if (t && t.length > 3) feats.push(t); });
      if (tier || price) pricing.push({ tier: tier || 'Plan', price: price || 'Custom', features: feats, isPopular });
    });

    if (pricing.length === 0) {
      const priceMatches = text.match(/\$\d+(?:\.\d+)?(?:\/(?:mo|month|year|yr|user))?/gi);
      if (priceMatches) {
        priceMatches.forEach(p => pricing.push({ tier: 'Detected', price: p, features: [], isPopular: false }));
      }
    }

    $('li, [class*="feature"], [class*="capability"]').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 10 && t.length < 300) features.push(t);
    });

    $('a, button').each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length < 50 && /^(start|sign up|get started|try|free|demo|book|contact|watch|learn)/i.test(t)) ctas.push(t);
    });

    $('[class*="testimonial"], [class*="review"], [class*="quote"], blockquote').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 30 && t.length < 500) testimonials.push(t);
    });

    $('[class*="changelog"], [class*="update"], [class*="release"], [class*="what\'s new"]').each((_, el) => {
      const h = $(el).find('h1, h2, h3, h4').first().text().trim();
      const b = $(el).find('p').first().text().trim().slice(0, 300);
      if (h) changelog += `${h}\n${b}\n\n`;
    });
  } catch {}

  return { text: text.slice(0, 50000), html: html.slice(0, 200000), title, meta, pricing, features: [...new Set(features)].slice(0, 80), hero, ctas: [...new Set(ctas)].slice(0, 5), testimonials: [...new Set(testimonials)].slice(0, 10), changelog: changelog.slice(0, 5000) };
}

export async function scrapeCompetitor(url: string, competitorId: string): Promise<ScrapedData> {
  let normalizedUrl = normalizeUrl(url);

  // Follow redirects to get the real URL
  try {
    const headResp = await axios.head(normalizedUrl, { headers: getHeaders(), timeout: 10000, maxRedirects: 10 });
    if (headResp.request?.res?.responseUrl) {
      normalizedUrl = headResp.request.res.responseUrl.replace(/\/+$/, '');
      console.log(`[Scraper] Resolved URL: ${normalizedUrl}`);
    }
  } catch {
    // Try GET instead of HEAD
    try {
      const getResp = await axios.get(normalizedUrl, { headers: getHeaders(), timeout: 10000, maxRedirects: 10 });
      if (getResp.request?.res?.responseUrl) {
        normalizedUrl = getResp.request.res.responseUrl.replace(/\/+$/, '');
        console.log(`[Scraper] Resolved URL: ${normalizedUrl}`);
      }
    } catch {}
  }

  let domain: string;
  try {
    domain = new URL(normalizedUrl).hostname.replace('www.', '');
  } catch {
    domain = normalizedUrl.replace(/https?:\/\//, '').split('/')[0];
  }

  const companyName = domain.split('.')[0];

  // Run ALL research in parallel: search queries, page scraping, and Exa deep research
  console.log(`[Scraper] Starting parallel research for ${companyName} (${domain})...`);

  const pages = [normalizedUrl, `${normalizedUrl}/pricing`, `${normalizedUrl}/changelog`, `${normalizedUrl}/features`, `${normalizedUrl}/about`];

  const [searchResults, pageResults, exaResult] = await Promise.all([
    searchCompetitorIntelligence(domain, companyName).catch(err => { console.error(`[Search] Failed:`, err.message); return ''; }),
    Promise.all(pages.map(p => scrapePage(p).catch(err => { console.error(`[Scraper] Failed ${p}:`, err.message); return { text: '', html: '', title: '', meta: '', hero: '', pricing: [], features: [], ctas: [], testimonials: [], changelog: '' }; }))),
    deepResearchCompetitor(companyName, domain).catch(err => { console.error(`[Exa] Failed:`, err.message); return null; }),
  ]);

  // Merge page results
  let allText = '', allHtml = '', title = '', meta = '', hero = '';
  let allPricing: PricingData[] = [], allFeatures: string[] = [], allCtas: string[] = [], allTestimonials: string[] = [], allChangelog = '';

  for (const result of pageResults) {
    allText += '\n\n' + result.text;
    allHtml += '\n\n' + result.html;
    if (!title) title = result.title;
    if (!meta) meta = result.meta;
    if (!hero) hero = result.hero;
    if (result.pricing.length > allPricing.length) allPricing = result.pricing;
    allFeatures.push(...result.features);
    allCtas.push(...result.ctas);
    allTestimonials.push(...result.testimonials);
    allChangelog += result.changelog;
  }

  console.log(`[Scraper] Parallel research complete: ${allText.length} chars text, ${allPricing.length} pricing, ${allFeatures.length} features` +
    (exaResult ? `, Exa: ${exaResult.allSearchText.length} chars` : ''));

  // Merge Exa reviews into scraped testimonials
  const exaReviews = exaResult?.reviewPages.map(r => ({ source: r.source, text: r.text.slice(0, 1000) })) || [];

  // Merge Exa news
  const exaNews = exaResult?.newsPages.map(n => ({ title: n.title, text: n.text.slice(0, 1000), date: n.publishedDate })) || [];

  // Build enrichedText with ALL data sources
  const enrichedText = [
    `=== COMPANY: ${companyName} ===`,
    `=== WEBSITE: ${normalizedUrl} ===`,
    `=== META: ${meta} ===`,
    allText,
    `\n\n=== WEB SEARCH INTELLIGENCE ===`,
    searchResults,
    ...(exaResult ? [
      `\n\n=== EXA DEEP RESEARCH ===`,
      exaResult.allSearchText,
    ] : []),
    ...(exaReviews.length > 0 ? [
      `\n\n=== EXA REVIEW DATA (${exaReviews.length} reviews) ===`,
      ...exaReviews.map(r => `[${r.source}] ${r.text}`),
    ] : []),
    ...(exaNews.length > 0 ? [
      `\n\n=== EXA NEWS & FUNDING (${exaNews.length} articles) ===`,
      ...exaNews.map(n => `[${n.date}] ${n.title}: ${n.text}`),
    ] : []),
    ...(exaResult?.techStack?.length ? [
      `\n\n=== EXA TECH STACK ===`,
      exaResult.techStack.join(', '),
    ] : []),
    ...(exaResult?.fundingInfo && exaResult.fundingInfo !== 'Not found' ? [
      `\n\n=== EXA FUNDING INFO ===`,
      exaResult.fundingInfo,
    ] : []),
    ...(exaResult?.competitorMentions?.length ? [
      `\n\n=== EXA COMPETITOR MENTIONS (${exaResult.competitorMentions.length}) ===`,
      ...exaResult.competitorMentions.map(c => `${c.url}: ${c.text.slice(0, 500)}`),
    ] : []),
    ...(exaResult?.employeeCount && exaResult.employeeCount !== 'Not found' ? [
      `\n\n=== EXA EMPLOYEE COUNT ===`,
      exaResult.employeeCount,
    ] : []),
  ].join('\n');

  // Combine all search text for enrichment
  const combinedSearchText = [
    searchResults,
    ...(exaResult ? [exaResult.allSearchText] : []),
  ].join('\n');

  const snapshotId = uuid();
  const db = getDB();
  db.prepare(`INSERT INTO snapshots (id, competitor_id, url, html_content, text_content, pricing_data, features_data, review_data, news_data, tech_stack, funding_info, competitor_mentions, employee_count, sentiment_score, research_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    snapshotId,
    competitorId,
    normalizedUrl,
    allHtml.slice(0, 500000),
    enrichedText.slice(0, 200000),
    JSON.stringify(allPricing),
    JSON.stringify(allFeatures),
    JSON.stringify(exaReviews),
    JSON.stringify(exaNews),
    JSON.stringify(exaResult?.techStack || []),
    exaResult?.fundingInfo || '',
    JSON.stringify(exaResult?.competitorMentions || []),
    exaResult?.employeeCount || '',
    '',
    JSON.stringify({ searchResults: combinedSearchText.slice(0, 50000) })
  );
  console.log(`[Scraper] Snapshot saved: ${snapshotId} for competitor ${competitorId}`);
  db.prepare(`UPDATE competitors SET last_scraped_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(competitorId);

  console.log(`[Scraper] Done. ${allText.length} chars text, ${allPricing.length} pricing, ${allFeatures.length} features, ${searchResults.length} search chars` +
    (exaResult ? `, Exa: ${exaResult.allSearchText.length} chars, ${exaResult.reviewPages.length} reviews, ${exaResult.newsPages.length} news, ${exaResult.techStack.length} tech items` : ''));

  return {
    snapshotId, url: normalizedUrl, title, textContent: enrichedText.slice(0, 100000),
    pricing: allPricing, features: [...new Set(allFeatures)].slice(0, 80),
    metaDescription: meta, heroText: hero, ctaText: [...new Set(allCtas)].slice(0, 5),
    testimonials: [...new Set(allTestimonials)].slice(0, 10), changelog: allChangelog.slice(0, 5000),
    searchResults: combinedSearchText,
    reviews: exaReviews,
    news: exaNews,
    techStack: exaResult?.techStack || [],
    fundingInfo: exaResult?.fundingInfo || '',
    competitorMentions: exaResult?.competitorMentions || [],
    employeeCount: exaResult?.employeeCount || '',
    allSearchText: combinedSearchText,
  };
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http')) url = 'https://' + url;
  url = url.replace(/\/+$/, '');

  // Detect Bing/Google redirect URLs and extract the real URL
  const bingMatch = url.match(/[?&]u=([^&]+)/);
  if (bingMatch) {
    const decoded = decodeURIComponent(bingMatch[1]);
    if (decoded.startsWith('http')) return decoded.replace(/\/+$/, '');
  }

  const googleMatch = url.match(/\/url\?q=([^&]+)/);
  if (googleMatch) {
    const decoded = decodeURIComponent(googleMatch[1]);
    if (decoded.startsWith('http')) return decoded.replace(/\/+$/, '');
  }

  return url;
}
