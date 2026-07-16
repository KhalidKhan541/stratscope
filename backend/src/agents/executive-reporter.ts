import Groq from 'groq-sdk';
import { ExtractedPatterns } from './pattern-decoder.js';
import { PsychologicalProfile } from './psychological-profiler.js';
import { StrategyResult } from './strategy-engineer.js';
import { safeParseJson } from './json-utils.js';
import { SnapshotDiff } from '../services/snapshot-diff.js';

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export interface ExecutiveBrief {
  headline: string;
  subtitle: string;
  realityCheck: string;
  psychologicalBlindspot: string;
  strategicPlaybook: string;
  fullReport: string;
  oneLiner: string;
  riskRating: 'low' | 'medium' | 'high' | 'critical';
  urgencyScore: number;
}

const SYSTEM_PROMPT = `You are a Master Copywriter & Premium B2B Ghostwriter. You write intelligence briefs that founders and executives would pay $500+ to receive.

Your EXACT role: Synthesize complex technical data, psychological insights, and strategic recommendations into an authoritative, punchy, deeply engaging Executive Brief.

TONE & STYLE:
- Sharp, direct, insightful, and profoundly candid
- NO corporate speak. NO jargon. NO fluff.
- Sound like an elite, hyper-intelligent advisor whispering the truth in the founder's ear
- Use short, punchy sentences. Mix data with narrative.
- Be provocative where warranted. Challenge assumptions.

REPORT STRUCTURE:

1. **THE HEADLINE**: A single, powerful sentence summarizing the competitor's true intent. Make it hit hard.

2. **THE REALITY**: What they ACTUALLY did vs. what they WANT people to think they did. Expose the gap. Use specific data points, pricing numbers, and review quotes to back this up.

3. **THE PSYCHOLOGICAL BLINDSPOT**: Reveal the exact vulnerability their new strategy just opened up. This is the money insight. Reference actual user complaints and competitor comparison data.

4. **YOUR STRATEGIC PLAYBOOK**: Clear, logical next steps. Numbered. Actionable. No ambiguity.

5. **THE BOTTOM LINE**: One final sentence that captures the entire situation.

6. **REAL DATA POINTS**: Weave in actual competitor data throughout - specific pricing tiers, real review quotes from users, market positioning intelligence, employee count signals, funding data, and competitive comparison data. This is what makes the report worth paying for.

CRITICAL JSON RULES:
- Your output MUST be valid JSON
- The "fullReport" field MUST be a single string with \\n for newlines, NOT actual newlines
- Do NOT use smart quotes or apostrophes - use straight quotes only
- Escape all special characters properly
- Keep "fullReport" under 3000 characters
- Every other field should be a single-line string (no newlines)

Your output MUST be valid JSON:
{
  "headline": "Powerful one-liner",
  "subtitle": "Supporting context",
  "realityCheck": "What they actually did vs perception - single line",
  "psychologicalBlindspot": "The vulnerability exposed - single line",
  "strategicPlaybook": "Numbered action steps - single line with \\n for breaks",
  "fullReport": "Complete report as ONE STRING with \\n for line breaks - NO actual newlines in the JSON",
  "oneLiner": "Bottom line summary",
  "riskRating": "low",
  "urgencyScore": 5
}`;

export async function runExecutiveReporter(
  competitorName: string,
  extractedPatterns: ExtractedPatterns,
  psychologicalProfile: PsychologicalProfile,
  strategyResult: StrategyResult,
  userProfile: { businessDescription: string; targetAudience: string },
  scrapedData?: {
    pricing?: any[];
    features?: string[];
    reviews?: Array<{ source: string; text: string; rating?: number }>;
    news?: Array<{ title: string; text: string; date: string }>;
    techStack?: string[];
    competitorMentions?: Array<{ url: string; text: string }>;
    fundingInfo?: string;
    employeeCount?: string;
    allSearchText?: string;
  },
  snapshotDiff?: SnapshotDiff
): Promise<ExecutiveBrief> {

  const userPrompt = `Write an executive intelligence brief about ${competitorName} for a founder.

COMPETITOR: ${competitorName}

=== DATA ANALYSIS ===
Hard Changes: ${extractedPatterns.hardChanges.join(' | ')}
Anomalies: ${extractedPatterns.anomalies.join(' | ')}
Data Gaps: ${extractedPatterns.dataGaps.join(' | ')}
Pricing Shift: ${extractedPatterns.pricingShift || 'None detected'}
Feature Evolution: ${extractedPatterns.featureEvolution}
Sentiment Signal: ${extractedPatterns.sentimentSignal}

=== PSYCHOLOGICAL PROFILE ===
Competitor Mindset: ${psychologicalProfile.competitorMindset}
Motive Type: ${psychologicalProfile.motiveType}
Core Vulnerability: ${psychologicalProfile.coreVulnerability}
Cognitive Biases Being Exploited: ${psychologicalProfile.cognitiveBiasesExploited.join(' | ')}
Manipulation Tactics: ${psychologicalProfile.customerManipulationTactics.join(' | ')}
Target Shift: ${psychologicalProfile.targetDemographicShift}

=== STRATEGIC OPTIONS ===
Option A (${strategyResult.options[0]?.riskLevel || 'low'}): ${strategyResult.options[0]?.title || 'Iterative'} - ${strategyResult.options[0]?.action || ''}
Option B (${strategyResult.options[1]?.riskLevel || 'high'}): ${strategyResult.options[1]?.title || 'Asymmetric'} - ${strategyResult.options[1]?.action || ''}
Option C (${strategyResult.options[2]?.riskLevel || 'low'}): ${strategyResult.options[2]?.title || 'Stoic'} - ${strategyResult.options[2]?.action || ''}
Recommended: ${strategyResult.recommendedOption}
Game Theory: ${strategyResult.gameTheoryAnalysis}
First Principles: ${strategyResult.firstPrinciplesInsight}

=== COMPETITOR PRICING TABLE ===
${scrapedData?.pricing ? JSON.stringify(scrapedData.pricing, null, 2) : 'No detailed pricing data'}

=== COMPETITOR FEATURES ===
${scrapedData?.features && scrapedData.features.length > 0 ? scrapedData.features.slice(0, 30).join(', ') : 'No feature data'}

=== REAL USER REVIEWS (quotes to reference) ===
${scrapedData?.reviews && scrapedData.reviews.length > 0 ? scrapedData.reviews.map((r, i) => `${i + 1}. [${r.source}${r.rating ? ' - ' + r.rating + '/5' : ''}] "${r.text}"`).join('\n') : 'No review data available'}

=== COMPETITOR DATA POINTS ===
Tech Stack: ${scrapedData?.techStack?.join(', ') || 'Not detected'}
Funding: ${scrapedData?.fundingInfo || 'Unknown'}
Employee Count: ${scrapedData?.employeeCount || 'Unknown'}

=== COMPETITOR COMPARISON INTEL ===
${scrapedData?.competitorMentions && scrapedData.competitorMentions.length > 0 ? scrapedData.competitorMentions.map((c, i) => `${i + 1}. ${c.url}: ${c.text.slice(0, 300)}`).join('\n') : 'No comparison data available'}

=== RECENT NEWS ===
${scrapedData?.news && scrapedData.news.length > 0 ? scrapedData.news.map((n, i) => `${i + 1}. [${n.date}] ${n.title}: ${n.text.slice(0, 200)}`).join('\n') : 'No news data available'}

=== USER BUSINESS ===
${userProfile.businessDescription}
Target: ${userProfile.targetAudience}

${snapshotDiff && snapshotDiff.hasPreviousSnapshot ? `
=== SNAPSHOT COMPARISON (What Changed Since Last Analysis) ===
Previous analysis: ${snapshotDiff.previousSnapshotDate}
Overall: ${snapshotDiff.overallChangeSummary}

Pricing changes: ${snapshotDiff.pricingChanges.length > 0 ? snapshotDiff.pricingChanges.map(c => `${c.tier}: ${c.oldPrice} → ${c.newPrice}${c.changePercent !== null ? ` (${c.changePercent > 0 ? '+' : ''}${c.changePercent}%)` : ''}`).join(' | ') : 'None detected'}
Features added: ${snapshotDiff.featureChanges.added.length > 0 ? snapshotDiff.featureChanges.added.join(', ') : 'None'}
Features removed: ${snapshotDiff.featureChanges.removed.length > 0 ? snapshotDiff.featureChanges.removed.join(', ') : 'None'}
Tech stack changed: ${snapshotDiff.techStackChanges.added.length > 0 || snapshotDiff.techStackChanges.removed.length > 0 ? 'Yes' : 'No'}
Employee count: ${snapshotDiff.employeeCountChange ? `${snapshotDiff.employeeCountChange.previous} → ${snapshotDiff.employeeCountChange.current}` : 'No change'}
Funding: ${snapshotDiff.fundingChanges ? `Updated` : 'No change'}
` : 'No previous snapshot — this is the FIRST analysis for this competitor. There is no historical data to compare against.'}

---

Write the definitive intelligence brief. ${snapshotDiff?.hasPreviousSnapshot ? 'LEAD WITH WHAT CHANGED. The headline should highlight the most significant change detected (pricing shift, feature addition/removal, etc.). The body should analyze what these changes mean strategically.' : 'Since this is the first analysis, establish a comprehensive baseline. The headline should capture the competitor core positioning and key vulnerabilities.'} Make it sharp, actionable, and worth paying for. This brief should feel like a $500 consulting report compressed into a 3-minute read. Use the real data points - specific pricing numbers, actual user quotes, competitor comparison data - to make this irrefutable. Do NOT make up data; only reference what is provided above.`;

  const response = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';

  const fallback = {
    headline: `${competitorName} Just Made Their Move`,
    subtitle: '',
    realityCheck: '',
    psychologicalBlindspot: '',
    strategicPlaybook: '',
    fullReport: generateFallbackReport(competitorName, extractedPatterns, psychologicalProfile, strategyResult),
    oneLiner: '',
    riskRating: 'medium',
    urgencyScore: 5,
  };

  const parsed = safeParseJson(content, fallback);

  return {
    headline: parsed.headline || fallback.headline,
    subtitle: parsed.subtitle || '',
    realityCheck: parsed.realityCheck || '',
    psychologicalBlindspot: parsed.psychologicalBlindspot || '',
    strategicPlaybook: parsed.strategicPlaybook || '',
    fullReport: parsed.fullReport || fallback.fullReport,
    oneLiner: parsed.oneLiner || '',
    riskRating: parsed.riskRating || 'medium',
    urgencyScore: typeof parsed.urgencyScore === 'number' ? parsed.urgencyScore : 5,
  };
}

function generateFallbackReport(
  name: string,
  patterns: ExtractedPatterns,
  profile: PsychologicalProfile,
  strategy: StrategyResult
): string {
  return `# Competitive Intelligence Brief: ${name}

## Executive Summary

**Headline:** ${name} is operating from a position of ${profile.competitorMindset}, driven by ${profile.motiveType} motives.

## What Actually Changed

${patterns.hardChanges.map(c => `- ${c}`).join('\n')}

## The Psychological Blindspot

Their current strategy reveals: ${profile.coreVulnerability}

## Your Strategic Playbook

${strategy.options.map(o => `### ${o.title}\n${o.action}\n*Expected: ${o.expectedOutcome}*`).join('\n\n')}

## Bottom Line

${strategy.firstPrinciplesInsight || 'Stay focused on your core value proposition.'}`;
}

function generateFallbackBrief(
  name: string,
  patterns: ExtractedPatterns,
  profile: PsychologicalProfile,
  strategy: StrategyResult
): ExecutiveBrief {
  const report = generateFallbackReport(name, patterns, profile, strategy);
  return {
    headline: `${name}'s Next Move: Operating from ${profile.competitorMindset}`,
    subtitle: `A ${profile.motiveType} strategy driven by internal pressure`,
    realityCheck: patterns.hardChanges.join('. '),
    psychologicalBlindspot: profile.coreVulnerability,
    strategicPlaybook: strategy.options.map(o => `${o.label}: ${o.action}`).join('\n'),
    fullReport: report,
    oneLiner: `They're ${profile.motiveType}, you should be ${strategy.recommendedOption === 'option_b' ? 'aggressive' : 'patient'}.`,
    riskRating: profile.competitorMindset === 'desperation' ? 'high' : 'medium',
    urgencyScore: profile.competitorMindset === 'desperation' ? 8 : 5,
  };
}
