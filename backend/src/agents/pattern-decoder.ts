import Groq from 'groq-sdk';
import { safeParseJson } from './json-utils.js';
import { SnapshotDiff } from '../services/snapshot-diff.js';

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export interface ExtractedPatterns {
  hardChanges: string[];
  anomalies: string[];
  dataGaps: string[];
  pricingShift: string | null;
  featureEvolution: string;
  sentimentSignal: string;
  rawConfidence: number;
}

const SYSTEM_PROMPT = `You are an Elite Data Analyst & Competitive Intelligence Specialist.

Your EXACT role: Strip away all marketing fluff, corporate jargon, and emotional language from competitor data. Identify ONLY hard, structural, mathematical changes.

ANALYSIS FRAMEWORK:
1. Feature & Product Evolution: What features were added, modified, or deprecated? Be specific.
2. Pricing Matrix: Calculate exact percentage changes in pricing tiers. Identify entry barrier shifts.
3. User Sentiment Signals: Extract functional failures or successes from review data.
4. Review Sentiment Patterns: Analyze actual user reviews for recurring complaints, praise themes, and sentiment trends. Identify specific pain points users mention.
5. Tech Stack Intelligence: Evaluate technology choices for strengths, vulnerabilities, and migration signals.
6. Funding & Growth Signals: Assess funding information, employee count changes, and growth trajectory indicators.
7. Competitive Positioning: Map how the competitor positions against others in their space using real data.

OUTPUT RULES:
- Be ruthlessly objective. No opinions, only facts.
- Use specific numbers, percentages, and dates when available.
- Flag anything that seems anomalous or sudden.
- Always identify what information is MISSING that would be critical to know.
- Quote specific user review text when identifying sentiment patterns.
- Reference actual competitor mentions and market positioning data.

Your output MUST be valid JSON matching this exact structure:
{
  "hardChanges": ["List of specific empirical changes"],
  "anomalies": ["Anything out of place or sudden"],
  "dataGaps": ["Critical missing information"],
  "pricingShift": "Description of pricing change or null",
  "featureEvolution": "Summary of feature changes",
  "sentimentSignal": "What users are actually saying",
  "rawConfidence": 0.0 to 1.0
}`;

export async function runPatternDecoder(scrapedData: {
  textContent: string;
  pricing: any[];
  features: string[];
  title: string;
  heroText: string;
  changelog: string;
  url: string;
  reviews?: Array<{ source: string; text: string; rating?: number }>;
  news?: Array<{ title: string; text: string; date: string }>;
  techStack?: string[];
  fundingInfo?: string;
  competitorMentions?: Array<{ url: string; text: string }>;
  employeeCount?: string;
  allSearchText?: string;
}, competitorName: string, snapshotDiff?: SnapshotDiff): Promise<ExtractedPatterns> {

  const userPrompt = `Analyze this competitor data for ${competitorName}. Strip ALL marketing fluff. Find the hard truths.

COMPETITOR: ${competitorName}
URL: ${scrapedData.url}
PAGE TITLE: ${scrapedData.title}
HERO MESSAGING: ${scrapedData.heroText}

PRICING DATA:
${JSON.stringify(scrapedData.pricing, null, 2)}

FEATURES DETECTED:
${scrapedData.features.slice(0, 30).join('\n')}

CHANGELOG/UPDATES:
${scrapedData.changelog.slice(0, 3000)}

PAGE CONTENT EXCERPT:
${scrapedData.textContent.slice(0, 8000)}

RESEARCH DATA:
${scrapedData.allSearchText ? scrapedData.allSearchText.slice(0, 12000) : 'No additional research data available'}

USER REVIEWS:
${scrapedData.reviews && scrapedData.reviews.length > 0 ? scrapedData.reviews.map((r: any, i: number) => `${i + 1}. [${r.source}${r.rating ? ' - ' + r.rating + '/5' : ''}] ${r.text}`).join('\n') : 'No review data available'}

NEWS & PRESS:
${scrapedData.news && scrapedData.news.length > 0 ? scrapedData.news.map((n: any, i: number) => `${i + 1}. [${n.date}] ${n.title}: ${n.text}`).join('\n') : 'No news data available'}

TECH STACK:
${scrapedData.techStack && scrapedData.techStack.length > 0 ? scrapedData.techStack.join(', ') : 'Not detected'}

FUNDING INFO:
${scrapedData.fundingInfo || 'No funding data available'}

COMPETITOR MENTIONS:
${scrapedData.competitorMentions && scrapedData.competitorMentions.length > 0 ? scrapedData.competitorMentions.map((c: any, i: number) => `${i + 1}. ${c.url}: ${c.text.slice(0, 300)}`).join('\n') : 'No competitor mention data available'}

EMPLOYEE COUNT:
${scrapedData.employeeCount || 'Unknown'}

${snapshotDiff && snapshotDiff.hasPreviousSnapshot ? `
=== SNAPSHOT COMPARISON (Previous vs Current) ===
Previous analysis date: ${snapshotDiff.previousSnapshotDate}
Changes detected: ${snapshotDiff.overallChangeSummary}

PRICING CHANGES: ${snapshotDiff.pricingChanges.length > 0 ? snapshotDiff.pricingChanges.map(c => `${c.tier}: ${c.oldPrice} → ${c.newPrice}${c.changePercent !== null ? ` (${c.changePercent > 0 ? '+' : ''}${c.changePercent}%)` : ''}`).join(' | ') : 'None'}

FEATURE CHANGES: ${snapshotDiff.featureChanges.added.length > 0 ? `Added: ${snapshotDiff.featureChanges.added.join(', ')}` : ''} ${snapshotDiff.featureChanges.removed.length > 0 ? `Removed: ${snapshotDiff.featureChanges.removed.join(', ')}` : ''}

TECH STACK CHANGES: ${snapshotDiff.techStackChanges.added.length > 0 ? `Added: ${snapshotDiff.techStackChanges.added.join(', ')}` : ''} ${snapshotDiff.techStackChanges.removed.length > 0 ? `Removed: ${snapshotDiff.techStackChanges.removed.join(', ')}` : ''}

EMPLOYEE COUNT: ${snapshotDiff.employeeCountChange ? `${snapshotDiff.employeeCountChange.previous} → ${snapshotDiff.employeeCountChange.current}` : 'No change'}
FUNDING: ${snapshotDiff.fundingChanges ? `Updated: ${snapshotDiff.fundingChanges.current}` : 'No change'}
` : 'No previous snapshot available — this is the first analysis for this competitor.'}

---

TASK: Identify the structural changes, mathematical shifts, and anomalies. ${snapshotDiff?.hasPreviousSnapshot ? 'FOCUS ON WHAT CHANGED since the previous analysis. Highlight pricing shifts, feature additions/removals, and any anomalies that suggest strategic moves.' : 'Since this is the first analysis, establish a comprehensive baseline of the competitor current state.'} Ignore all marketing language. What actually changed? Use the review data, news, and competitive intelligence to ground your analysis in real evidence.`;

  const response = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  
  const fallback = {
    hardChanges: ['Analysis completed but JSON parsing failed'],
    anomalies: [],
    dataGaps: ['Full re-analysis recommended'],
    pricingShift: null,
    featureEvolution: content.slice(0, 1000),
    sentimentSignal: '',
    rawConfidence: 0.3,
  };

  const parsed = safeParseJson(content, fallback);
  
  return {
    hardChanges: parsed.hardChanges || fallback.hardChanges,
    anomalies: parsed.anomalies || [],
    dataGaps: parsed.dataGaps || [],
    pricingShift: parsed.pricingShift || null,
    featureEvolution: parsed.featureEvolution || '',
    sentimentSignal: parsed.sentimentSignal || '',
    rawConfidence: typeof parsed.rawConfidence === 'number' ? parsed.rawConfidence : 0.7,
  };
}
