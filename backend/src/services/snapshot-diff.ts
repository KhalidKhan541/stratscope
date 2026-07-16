import { getDB } from '../db/schema.js';

export interface PricingChange {
  tier: string;
  oldPrice: string;
  newPrice: string;
  changePercent: number | null;
}

export interface SnapshotDiff {
  hasPreviousSnapshot: boolean;
  previousSnapshotDate: string | null;
  currentSnapshotDate: string;
  pricingChanges: PricingChange[];
  featureChanges: { added: string[]; removed: string[] };
  reviewSentimentChange: { previous: number; current: number; trend: 'improving' | 'declining' | 'stable' } | null;
  techStackChanges: { added: string[]; removed: string[] };
  employeeCountChange: { previous: string; current: string } | null;
  fundingChanges: { previous: string; current: string } | null;
  competitorMentionChanges: { added: string[]; removed: string[] };
  overallChangeSummary: string;
}

function parseJsonSafe(raw: string | null, fallback: any = []) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function extractPriceNumber(priceStr: string): number | null {
  const match = priceStr.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function computeFeatureChanges(oldFeatures: string[], newFeatures: string[]): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldFeatures.map(f => f.toLowerCase().trim()));
  const newSet = new Set(newFeatures.map(f => f.toLowerCase().trim()));

  const added = newFeatures.filter(f => !oldSet.has(f.toLowerCase().trim()));
  const removed = oldFeatures.filter(f => !newSet.has(f.toLowerCase().trim()));

  return {
    added: added.slice(0, 20),
    removed: removed.slice(0, 20),
  };
}

function computeTechChanges(oldTech: string[], newTech: string[]): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldTech.map(t => t.toLowerCase()));
  const newSet = new Set(newTech.map(t => t.toLowerCase()));

  return {
    added: newTech.filter(t => !oldSet.has(t.toLowerCase())),
    removed: oldTech.filter(t => !newSet.has(t.toLowerCase())),
  };
}

function computePricingChanges(oldPricing: any[], newPricing: any[]): PricingChange[] {
  const changes: PricingChange[] = [];

  // Build map of old prices by tier name
  const oldPriceMap = new Map<string, string>();
  for (const p of oldPricing) {
    const tier = (p.tier || '').toLowerCase().trim();
    if (tier && p.price) oldPriceMap.set(tier, p.price);
  }

  for (const p of newPricing) {
    const tier = (p.tier || '').toLowerCase().trim();
    if (!tier || !p.price) continue;

    const oldPrice = oldPriceMap.get(tier);
    if (oldPrice && oldPrice !== p.price) {
      const oldNum = extractPriceNumber(oldPrice);
      const newNum = extractPriceNumber(p.price);
      let changePercent: number | null = null;
      if (oldNum && newNum && oldNum > 0) {
        changePercent = Math.round(((newNum - oldNum) / oldNum) * 100);
      }
      changes.push({
        tier: p.tier,
        oldPrice,
        newPrice: p.price,
        changePercent,
      });
    }
  }

  return changes;
}

function computeMentionChanges(oldMentions: any[], newMentions: any[]): { added: string[]; removed: string[] } {
  const oldUrls = new Set(oldMentions.map((m: any) => m.url || ''));
  const newUrls = new Set(newMentions.map((m: any) => m.url || ''));

  return {
    added: newMentions.filter((m: any) => !oldUrls.has(m.url)).map((m: any) => m.url).slice(0, 10),
    removed: oldMentions.filter((m: any) => !newUrls.has(m.url)).map((m: any) => m.url).slice(0, 10),
  };
}

function generateOverallSummary(diff: Omit<SnapshotDiff, 'overallChangeSummary'>): string {
  const parts: string[] = [];

  if (diff.pricingChanges.length > 0) {
    parts.push(`${diff.pricingChanges.length} pricing change(s) detected`);
  }
  if (diff.featureChanges.added.length > 0 || diff.featureChanges.removed.length > 0) {
    parts.push(`${diff.featureChanges.added.length} features added, ${diff.featureChanges.removed.length} removed`);
  }
  if (diff.techStackChanges.added.length > 0 || diff.techStackChanges.removed.length > 0) {
    parts.push(`tech stack changed`);
  }
  if (diff.reviewSentimentChange && diff.reviewSentimentChange.trend !== 'stable') {
    parts.push(`review sentiment ${diff.reviewSentimentChange.trend}`);
  }
  if (diff.employeeCountChange) {
    parts.push(`employee count changed`);
  }
  if (diff.fundingChanges) {
    parts.push(`funding information updated`);
  }

  return parts.length > 0 ? parts.join('; ') : 'No significant changes detected since last analysis';
}

export function getPreviousSnapshot(competitorId: string): any | null {
  const db = getDB();
  const snapshot = db.prepare(`
    SELECT * FROM snapshots
    WHERE competitor_id = ?
    ORDER BY scraped_at DESC
    LIMIT 1
  `).get(competitorId) as any;

  if (snapshot) {
    console.log(`[Diff] Found previous snapshot ${snapshot.id} from ${snapshot.scraped_at}`);
  } else {
    console.log(`[Diff] No previous snapshot found for competitor ${competitorId}`);
    // Debug: check if ANY snapshots exist for this competitor
    const count = db.prepare('SELECT COUNT(*) as c FROM snapshots WHERE competitor_id = ?').get(competitorId) as any;
    console.log(`[Diff] Total snapshots in DB for this competitor: ${count?.c || 0}`);
  }

  return snapshot || null;
}

export function computeSnapshotDiff(
  previousSnapshot: any | null,
  currentData: {
    pricing: any[];
    features: string[];
    reviews?: Array<{ source: string; text: string; rating?: number }>;
    techStack?: string[];
    competitorMentions?: Array<{ url: string; text: string }>;
    employeeCount?: string;
    fundingInfo?: string;
  }
): SnapshotDiff {
  if (!previousSnapshot) {
    return {
      hasPreviousSnapshot: false,
      previousSnapshotDate: null,
      currentSnapshotDate: new Date().toISOString(),
      pricingChanges: [],
      featureChanges: { added: [], removed: [] },
      reviewSentimentChange: null,
      techStackChanges: { added: [], removed: [] },
      employeeCountChange: null,
      fundingChanges: null,
      competitorMentionChanges: { added: [], removed: [] },
      overallChangeSummary: 'First analysis — no previous data to compare against',
    };
  }

  const oldPricing = parseJsonSafe(previousSnapshot.pricing_data, []);
  const oldFeatures = parseJsonSafe(previousSnapshot.features_data, []);
  const oldReviews = parseJsonSafe(previousSnapshot.review_data, []);
  const oldTech = parseJsonSafe(previousSnapshot.tech_stack, []);
  const oldMentions = parseJsonSafe(previousSnapshot.competitor_mentions, []);
  const oldEmployeeCount = previousSnapshot.employee_count || '';
  const oldFunding = previousSnapshot.funding_info || '';

  const pricingChanges = computePricingChanges(oldPricing, currentData.pricing);
  const featureChanges = computeFeatureChanges(oldFeatures, currentData.features);
  const techStackChanges = computeTechChanges(oldTech, currentData.techStack || []);
  const competitorMentionChanges = computeMentionChanges(oldMentions, currentData.competitorMentions || []);

  // Simple review count comparison
  let reviewSentimentChange = null;
  if (oldReviews.length > 0 && currentData.reviews && currentData.reviews.length > 0) {
    const oldCount = oldReviews.length;
    const newCount = currentData.reviews.length;
    const trend: 'improving' | 'declining' | 'stable' = newCount > oldCount * 1.1 ? 'improving' : newCount < oldCount * 0.9 ? 'declining' : 'stable';
    reviewSentimentChange = { previous: oldCount, current: newCount, trend };
  }

  const employeeCountChange = (oldEmployeeCount && currentData.employeeCount && oldEmployeeCount !== currentData.employeeCount)
    ? { previous: oldEmployeeCount, current: currentData.employeeCount }
    : null;

  const fundingChanges = (oldFunding && currentData.fundingInfo && oldFunding !== currentData.fundingInfo)
    ? { previous: oldFunding, current: currentData.fundingInfo }
    : null;

  const diff = {
    hasPreviousSnapshot: true,
    previousSnapshotDate: previousSnapshot.scraped_at,
    currentSnapshotDate: new Date().toISOString(),
    pricingChanges,
    featureChanges,
    reviewSentimentChange,
    techStackChanges,
    employeeCountChange,
    fundingChanges,
    competitorMentionChanges,
  };

  return {
    ...diff,
    overallChangeSummary: generateOverallSummary(diff),
  };
}
