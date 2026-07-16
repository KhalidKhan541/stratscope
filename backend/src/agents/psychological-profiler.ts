import Groq from 'groq-sdk';
import { ExtractedPatterns } from './pattern-decoder.js';
import { safeParseJson } from './json-utils.js';
import { SnapshotDiff } from '../services/snapshot-diff.js';

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export interface PsychologicalProfile {
  competitorMindset: 'fear' | 'aggression' | 'confidence' | 'desperation' | 'calculated';
  motiveType: 'defense' | 'offense' | 'desperation' | 'expansion' | 'pivoting';
  cognitiveBiasesExploited: string[];
  targetDemographicShift: string;
  customerManipulationTactics: string[];
  coreVulnerability: string;
  emotionalTrigger: string;
  internalPressureSignals: string[];
  confidenceScore: number;
}

const SYSTEM_PROMPT = `You are a Cognitive Scientist & Corporate Behavioral Psychologist specializing in competitive strategy analysis.

Your EXACT role: Reverse-engineer the competitor's internal psychological state, motivations, and customer manipulation strategy from their observable actions.

PSYCHOLOGICAL FRAMEWORK:
1. Cognitive Triggers: Which human biases is the competitor weaponizing? (Loss Aversion, Social Proof, Scarcity, Bandwagon Effect, Anchoring, Authority Bias, etc.)
2. Motive Profiling: Are they acting from DEFENSE (fear of losing share to the user), OFFENSE (capitalizing on a trend), or DESPERATION (slashing prices/bloating features to prevent churn)?
3. Identity Manipulation: How are they trying to alter their perceived user identity? (e.g., shifting from "frugal builders" to "status-seeking executives")
4. Pressure Signals: What internal company pressures (investor pressure, churn rates, competitive threat) are driving these moves?
5. User Complaint Analysis: What are actual users saying in reviews? Identify real pain points, frustration patterns, and unmet needs that reveal the competitor's weaknesses.
6. Market Reality Check: How does their claimed positioning compare to how users actually perceive them? Where is the perception gap?
7. Competitor Comparison Intelligence: How do users compare them to alternatives? What alternatives are users switching to and from?

OUTPUT RULES:
- Think like a behavioral psychologist analyzing a subject
- Identify the FEAR or DESIRE driving each action
- Find the blind spot their strategy creates
- Be specific about which psychological levers they're pulling
- Ground your analysis in actual user review quotes and complaints
- Reference real market positioning data, not just marketing claims

Your output MUST be valid JSON matching this exact structure:
{
  "competitorMindset": "fear|aggression|confidence|desperation|calculated",
  "motiveType": "defense|offense|desperation|expansion|pivoting",
  "cognitiveBiasesExploited": ["List of biases being weaponized"],
  "targetDemographicShift": "How they're changing who they appeal to",
  "customerManipulationTactics": ["Specific manipulation tactics identified"],
  "coreVulnerability": "The psychological blind spot this creates",
  "emotionalTrigger": "What emotion they're primarily targeting",
  "internalPressureSignals": ["What internal pressures are driving this"],
  "confidenceScore": 0.0 to 1.0
}`;

export async function runPsychologicalProfiler(
  extractedPatterns: ExtractedPatterns,
  competitorName: string,
  userProfile: { businessDescription: string; targetAudience: string; pricing: string },
  scrapedData?: {
    reviews?: Array<{ source: string; text: string; rating?: number }>;
    news?: Array<{ title: string; text: string; date: string }>;
    competitorMentions?: Array<{ url: string; text: string }>;
    employeeCount?: string;
    allSearchText?: string;
  },
  snapshotDiff?: SnapshotDiff
): Promise<PsychologicalProfile> {

  const userPrompt = `Conduct a psychological profile of ${competitorName} based on their recent strategic moves.

COMPETITOR: ${competitorName}

EXTRACTED PATTERNS (from data analysis):
Hard Changes:
${extractedPatterns.hardChanges.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Anomalies Detected:
${extractedPatterns.anomalies.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Pricing Shift: ${extractedPatterns.pricingShift || 'None detected'}
Feature Evolution: ${extractedPatterns.featureEvolution}
Sentiment Signal: ${extractedPatterns.sentimentSignal}
Data Confidence: ${extractedPatterns.rawConfidence}

USER REVIEWS & COMPLAINTS:
${scrapedData?.reviews && scrapedData.reviews.length > 0 ? scrapedData.reviews.map((r, i) => `${i + 1}. [${r.source}${r.rating ? ' - ' + r.rating + '/5' : ''}] ${r.text}`).join('\n') : 'No review data available'}

COMPETITOR MENTIONS & COMPARISONS:
${scrapedData?.competitorMentions && scrapedData.competitorMentions.length > 0 ? scrapedData.competitorMentions.map((c, i) => `${i + 1}. ${c.url}: ${c.text.slice(0, 300)}`).join('\n') : 'No competitor comparison data available'}

MARKET POSITIONING INTEL:
${scrapedData?.allSearchText ? scrapedData.allSearchText.slice(0, 8000) : 'No additional positioning data available'}

EMPLOYEE COUNT: ${scrapedData?.employeeCount || 'Unknown'}

RECENT NEWS & SIGNALS:
${scrapedData?.news && scrapedData.news.length > 0 ? scrapedData.news.map((n, i) => `${i + 1}. [${n.date}] ${n.title}: ${n.text.slice(0, 200)}`).join('\n') : 'No news data available'}

USER'S BUSINESS:
${userProfile.businessDescription}
Target Audience: ${userProfile.targetAudience}
Pricing: ${userProfile.pricing}

${snapshotDiff && snapshotDiff.hasPreviousSnapshot ? `
=== SNAPSHOT COMPARISON ===
Previous analysis: ${snapshotDiff.previousSnapshotDate}
Changes: ${snapshotDiff.overallChangeSummary}
Pricing changes: ${snapshotDiff.pricingChanges.length > 0 ? snapshotDiff.pricingChanges.map(c => `${c.tier}: ${c.oldPrice} → ${c.newPrice}`).join(', ') : 'None'}
Features added: ${snapshotDiff.featureChanges.added.length > 0 ? snapshotDiff.featureChanges.added.join(', ') : 'None'}
Features removed: ${snapshotDiff.featureChanges.removed.length > 0 ? snapshotDiff.featureChanges.removed.join(', ') : 'None'}
` : 'No previous snapshot — first analysis for this competitor.'}

---

TASK: Reverse-engineer their internal psychological state. ${snapshotDiff?.hasPreviousSnapshot ? 'FOCUS ON WHAT THEIR CHANGES REVEAL about their fears, desperation, or aggression. Every pricing change, feature move, or staffing shift is a signal of internal pressure. What does this pattern of changes tell you about what they are AFRAID of?' : 'Since this is the first analysis, establish a psychological baseline from their current positioning, messaging, and market behavior.'} What are they AFRAID of? What do they WANT? What BLIND SPOT did their latest move create? Use actual user complaints and competitor comparison data to ground your psychological analysis in reality. Think like a behavioral psychologist, not a business analyst.`;

  const response = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';

  const fallback = {
    competitorMindset: 'calculated' as const,
    motiveType: 'offense' as const,
    cognitiveBiasesExploited: [],
    targetDemographicShift: '',
    customerManipulationTactics: [],
    coreVulnerability: 'Analysis incomplete - manual review recommended',
    emotionalTrigger: '',
    internalPressureSignals: [],
    confidenceScore: 0.3,
  };

  const parsed = safeParseJson(content, fallback);

  return {
    competitorMindset: parsed.competitorMindset || fallback.competitorMindset,
    motiveType: parsed.motiveType || fallback.motiveType,
    cognitiveBiasesExploited: parsed.cognitiveBiasesExploited || [],
    targetDemographicShift: parsed.targetDemographicShift || '',
    customerManipulationTactics: parsed.customerManipulationTactics || [],
    coreVulnerability: parsed.coreVulnerability || fallback.coreVulnerability,
    emotionalTrigger: parsed.emotionalTrigger || '',
    internalPressureSignals: parsed.internalPressureSignals || [],
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.6,
  };
}
