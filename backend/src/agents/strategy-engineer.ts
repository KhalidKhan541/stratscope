import Groq from 'groq-sdk';
import { ExtractedPatterns } from './pattern-decoder.js';
import { PsychologicalProfile } from './psychological-profiler.js';
import { safeParseJson } from './json-utils.js';
import { SnapshotDiff } from '../services/snapshot-diff.js';

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export interface StrategicOption {
  id: string;
  label: string;
  riskLevel: 'low' | 'medium' | 'high';
  type: 'iterative' | 'asymmetric' | 'stoic';
  title: string;
  action: string;
  expectedOutcome: string;
  competitorResponse: string;
  twoMovesAhead: string;
  timeframe: string;
  resourceRequirement: string;
}

export interface StrategyResult {
  options: StrategicOption[];
  recommendedOption: string;
  gameTheoryAnalysis: string;
  firstPrinciplesInsight: string;
  sunkCostWarning: string;
  confidenceScore: number;
}

const SYSTEM_PROMPT = `You are a Game Theorist & Systematic Logic Philosopher specializing in competitive strategy.

Your EXACT role: Develop objective, high-probability counter-strategies. You MUST strip away all emotional responses (panic, copying, sunk-cost fallacies) and reason from first principles.

LOGICAL REASONING RULES:
1. First-Principles Thinking: NEVER suggest copying the competitor. Identify the foundational value the user provides and AMPLIFY it.
2. The Sunk-Cost Filter: Ignore what the user has previously spent. What is the logical best move RIGHT NOW based on the competitor's vulnerability?
3. Game Theory Projections: For every counter-move, simulate the competitor's next logical reaction. Play out the sequence 2 MOVES AHEAD.
4. Asymmetric Advantage: Look for moves where the user gains MORE than the competitor can respond to.
5. Real Pricing Comparisons: Use actual pricing data and numbers to identify undercutting opportunities or premium positioning gaps.
6. Feature Gap Analysis: Leverage detected features and real user feedback to identify specific feature gaps to exploit or avoid.
7. Market Positioning Opportunities: Use competitive positioning data and market intelligence to find whitespace the competitor is ignoring.

OUTPUT STRUCTURE - 3 DISTINCT OPTIONS:

Option A (Low Risk/Iterative): Safe, incremental improvement. Small competitive edge.
Option B (Asymmetric/Disruptive): High-leverage move exploiting their psychological vulnerability.  
Option C (The Stoic Path/Do Nothing): Why holding the line might be mathematically superior.

Each option MUST include:
- Specific action to take
- Expected outcome
- Competitor's likely response
- What happens 2 moves ahead
- Timeframe for results
- Resources required

Your output MUST be valid JSON matching this exact structure:
{
  "options": [
    {
      "id": "option_a",
      "label": "Option A",
      "riskLevel": "low|medium|high",
      "type": "iterative|asymmetric|stoic",
      "title": "Short title",
      "action": "Specific action to take",
      "expectedOutcome": "What will happen",
      "competitorResponse": "How they'll react",
      "twoMovesAhead": "Second-order effects",
      "timeframe": "When results expected",
      "resourceRequirement": "What's needed"
    }
  ],
  "recommendedOption": "option_a|option_b|option_c",
  "gameTheoryAnalysis": "Overall game theory assessment",
  "firstPrinciplesInsight": "The foundational truth",
  "sunkCostWarning": "What to ignore",
  "confidenceScore": 0.0 to 1.0
}`;

export async function runStrategyEngineer(
  extractedPatterns: ExtractedPatterns,
  psychologicalProfile: PsychologicalProfile,
  competitorName: string,
  userProfile: { businessDescription: string; targetAudience: string; pricing: string; strengths: string },
  scrapedData?: {
    pricing?: any[];
    features?: string[];
    reviews?: Array<{ source: string; text: string; rating?: number }>;
    techStack?: string[];
    competitorMentions?: Array<{ url: string; text: string }>;
    fundingInfo?: string;
    employeeCount?: string;
    allSearchText?: string;
  },
  snapshotDiff?: SnapshotDiff
): Promise<StrategyResult> {

  const userPrompt = `Develop a counter-strategy for the user against ${competitorName}.

COMPETITOR: ${competitorName}

COMPETITOR DATA ANALYSIS:
Hard Changes: ${extractedPatterns.hardChanges.join(' | ')}
Anomalies: ${extractedPatterns.anomalies.join(' | ')}
Pricing Shift: ${extractedPatterns.pricingShift || 'None'}
Confidence: ${extractedPatterns.rawConfidence}

COMPETITOR PSYCHOLOGICAL PROFILE:
Mindset: ${psychologicalProfile.competitorMindset}
Motive: ${psychologicalProfile.motiveType}
Vulnerability: ${psychologicalProfile.coreVulnerability}
Biases Being Exploited: ${psychologicalProfile.cognitiveBiasesExploited.join(' | ')}
Manipulation Tactics: ${psychologicalProfile.customerManipulationTactics.join(' | ')}
Internal Pressures: ${psychologicalProfile.internalPressureSignals.join(' | ')}

COMPETITOR PRICING DATA:
${scrapedData?.pricing ? JSON.stringify(scrapedData.pricing, null, 2) : 'No detailed pricing data available'}

COMPETITOR FEATURES:
${scrapedData?.features && scrapedData.features.length > 0 ? scrapedData.features.slice(0, 40).join('\n') : 'No feature data available'}

USER REVIEWS (real complaints & praise):
${scrapedData?.reviews && scrapedData.reviews.length > 0 ? scrapedData.reviews.map((r, i) => `${i + 1}. [${r.source}${r.rating ? ' - ' + r.rating + '/5' : ''}] ${r.text}`).join('\n') : 'No review data available'}

TECH STACK: ${scrapedData?.techStack?.join(', ') || 'Not detected'}
FUNDING: ${scrapedData?.fundingInfo || 'Unknown'}
EMPLOYEE COUNT: ${scrapedData?.employeeCount || 'Unknown'}

COMPETITOR COMPARISON DATA:
${scrapedData?.competitorMentions && scrapedData.competitorMentions.length > 0 ? scrapedData.competitorMentions.map((c, i) => `${i + 1}. ${c.url}: ${c.text.slice(0, 300)}`).join('\n') : 'No comparison data available'}

MARKET INTELLIGENCE:
${scrapedData?.allSearchText ? scrapedData.allSearchText.slice(0, 8000) : 'No additional market data available'}

USER'S BUSINESS:
${userProfile.businessDescription}
Target Audience: ${userProfile.targetAudience}
Pricing: ${userProfile.pricing}
Key Strengths: ${userProfile.strengths}

${snapshotDiff && snapshotDiff.hasPreviousSnapshot ? `
=== SNAPSHOT COMPARISON (What Changed) ===
Previous analysis: ${snapshotDiff.previousSnapshotDate}
${snapshotDiff.overallChangeSummary}

Pricing changes: ${snapshotDiff.pricingChanges.length > 0 ? snapshotDiff.pricingChanges.map(c => `${c.tier}: ${c.oldPrice} → ${c.newPrice}${c.changePercent !== null ? ` (${c.changePercent > 0 ? '+' : ''}${c.changePercent}%)` : ''}`).join(' | ') : 'None'}
Features added: ${snapshotDiff.featureChanges.added.length > 0 ? snapshotDiff.featureChanges.added.join(', ') : 'None'}
Features removed: ${snapshotDiff.featureChanges.removed.length > 0 ? snapshotDiff.featureChanges.removed.join(', ') : 'None'}
Tech changes: ${snapshotDiff.techStackChanges.added.length > 0 ? `Added: ${snapshotDiff.techStackChanges.added.join(', ')}` : ''} ${snapshotDiff.techStackChanges.removed.length > 0 ? `Removed: ${snapshotDiff.techStackChanges.removed.join(', ')}` : ''}
` : 'No previous snapshot — first analysis for this competitor.'}

---

TASK: Develop 3 distinct counter-strategies using game theory and first-principles thinking. ${snapshotDiff?.hasPreviousSnapshot ? 'Your strategies MUST be informed by what changed. If they raised prices, what does that create for you? If they added features, where are the gaps they still left open? If they removed features, who are the displaced users you can capture?' : 'Since this is the first analysis, build strategies based on the current competitive landscape.'}

CRITICAL RULES:
- Do NOT suggest copying the competitor
- Ignore sunk costs - what's the logical BEST move NOW?
- For each move, project 2 moves ahead
- Find the asymmetric advantage
- Strip all emotion from your analysis
- Use real pricing numbers to identify specific price-based opportunities
- Leverage actual user complaints to find vulnerability points
- Reference real feature gaps and market positioning data

Think like a cold, rational strategist. What move gives the user the highest probability of winning?`;

  const response = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';

  const defaultOptions: StrategicOption[] = [
    { id: 'option_a', label: 'Option A', riskLevel: 'low', type: 'iterative', title: 'Iterative Improvement', action: '', expectedOutcome: '', competitorResponse: '', twoMovesAhead: '', timeframe: '1-3 months', resourceRequirement: 'Low' },
    { id: 'option_b', label: 'Option B', riskLevel: 'high', type: 'asymmetric', title: 'Asymmetric Disruption', action: '', expectedOutcome: '', competitorResponse: '', twoMovesAhead: '', timeframe: '1-2 months', resourceRequirement: 'Medium' },
    { id: 'option_c', label: 'Option C', riskLevel: 'low', type: 'stoic', title: 'Hold the Line', action: '', expectedOutcome: '', competitorResponse: '', twoMovesAhead: '', timeframe: '3-6 months', resourceRequirement: 'Minimal' },
  ];

  const fallback = {
    options: defaultOptions,
    recommendedOption: 'option_b',
    gameTheoryAnalysis: 'Analysis completed',
    firstPrinciplesInsight: '',
    sunkCostWarning: '',
    confidenceScore: 0.6,
  };

  const parsed = safeParseJson(content, fallback);

  const options = (parsed.options || defaultOptions).map((opt: any, i: number) => ({
    ...defaultOptions[i],
    ...opt,
  }));

  while (options.length < 3) options.push(defaultOptions[options.length]);

  return {
    options: options.slice(0, 3),
    recommendedOption: parsed.recommendedOption || 'option_b',
    gameTheoryAnalysis: parsed.gameTheoryAnalysis || '',
    firstPrinciplesInsight: parsed.firstPrinciplesInsight || '',
    sunkCostWarning: parsed.sunkCostWarning || '',
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.6,
  };
}
