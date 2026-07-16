import { v4 as uuid } from 'uuid';
import { getDB } from '../db/schema.js';
import { scrapeCompetitor } from '../scraper/index.js';
import { runPatternDecoder, ExtractedPatterns } from './pattern-decoder.js';
import { runPsychologicalProfiler, PsychologicalProfile } from './psychological-profiler.js';
import { runStrategyEngineer, StrategyResult } from './strategy-engineer.js';
import { runExecutiveReporter, ExecutiveBrief } from './executive-reporter.js';
import { updateProgress } from '../services/progress.js';
import { getPreviousSnapshot, computeSnapshotDiff, SnapshotDiff } from '../services/snapshot-diff.js';

export interface AnalysisResult {
  analysisId: string;
  status: 'completed' | 'failed';
  extractedPatterns: ExtractedPatterns;
  psychologicalProfile: PsychologicalProfile;
  strategyResult: StrategyResult;
  executiveBrief: ExecutiveBrief;
  snapshotDiff: SnapshotDiff;
  processingTimeMs: number;
}

export interface UserProfile {
  businessDescription: string;
  targetAudience: string;
  pricing: string;
  strengths: string;
}

export async function runFullAnalysis(
  userId: string,
  competitorId: string,
  competitorUrl: string,
  competitorName: string,
  userProfile: UserProfile
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const analysisId = uuid();
  const db = getDB();

  db.prepare(`INSERT INTO analyses (id, user_id, competitor_id, snapshot_id, status) VALUES (?, ?, ?, ?, 'processing')`).run(analysisId, userId, competitorId, 'pending');

  try {
    // Step 0: Fetch previous snapshot for comparison
    console.log(`[${analysisId}] Fetching previous snapshot for comparison...`);
    const previousSnapshot = getPreviousSnapshot(competitorId);

    // Step 1: Scrape current data
    updateProgress(analysisId, 1, 'Scraping competitor website...');
    console.log(`[${analysisId}] Step 1/5: Scraping ${competitorUrl}...`);
    const scrapedData = await scrapeCompetitor(competitorUrl, competitorId);

    db.prepare(`UPDATE analyses SET snapshot_id = ? WHERE id = ?`).run(scrapedData.snapshotId, analysisId);

    // Step 1.5: Compute diff against previous snapshot
    console.log(`[${analysisId}] Computing snapshot diff...`);
    const snapshotDiff = computeSnapshotDiff(previousSnapshot, {
      pricing: scrapedData.pricing,
      features: scrapedData.features,
      reviews: scrapedData.reviews,
      techStack: scrapedData.techStack,
      competitorMentions: scrapedData.competitorMentions,
      employeeCount: scrapedData.employeeCount,
      fundingInfo: scrapedData.fundingInfo,
    });
    console.log(`[${analysisId}] Diff: ${snapshotDiff.overallChangeSummary}`);

    // Step 2: Decode patterns (with comparison context)
    updateProgress(analysisId, 2, 'Decoding data patterns...');
    console.log(`[${analysisId}] Step 2/5: Decoding data patterns...`);
    const extractedPatterns = await runPatternDecoder(scrapedData, competitorName, snapshotDiff);

    // Step 3: Psychological profiling (with comparison context)
    updateProgress(analysisId, 3, 'Profiling psychological state...');
    console.log(`[${analysisId}] Step 3/5: Profiling psychological state...`);
    const psychologicalProfile = await runPsychologicalProfiler(extractedPatterns, competitorName, userProfile, scrapedData, snapshotDiff);

    // Step 4: Strategy engineering (with comparison context)
    updateProgress(analysisId, 4, 'Engineering strategy...');
    console.log(`[${analysisId}] Step 4/5: Engineering strategy...`);
    const strategyResult = await runStrategyEngineer(extractedPatterns, psychologicalProfile, competitorName, userProfile, scrapedData, snapshotDiff);

    // Step 5: Executive report (with comparison context)
    updateProgress(analysisId, 5, 'Generating executive brief...');
    console.log(`[${analysisId}] Step 5/5: Generating executive brief...`);
    const executiveBrief = await runExecutiveReporter(competitorName, extractedPatterns, psychologicalProfile, strategyResult, userProfile, scrapedData, snapshotDiff);

    const processingTimeMs = Date.now() - startTime;

    db.prepare(`
      UPDATE analyses SET
        status = 'completed',
        extracted_patterns = ?,
        psychological_profile = ?,
        strategic_options = ?,
        executive_brief = ?,
        snapshot_diff = ?,
        processing_time_ms = ?,
        completed_at = datetime('now')
      WHERE id = ?
    `).run(
      JSON.stringify(extractedPatterns),
      JSON.stringify(psychologicalProfile),
      JSON.stringify(strategyResult),
      JSON.stringify(executiveBrief),
      JSON.stringify(snapshotDiff),
      processingTimeMs,
      analysisId
    );

    db.prepare(`UPDATE users SET analyses_count = analyses_count + 1 WHERE id = ?`).run(userId);

    console.log(`[${analysisId}] Completed in ${processingTimeMs}ms`);

    return { analysisId, status: 'completed', extractedPatterns, psychologicalProfile, strategyResult, executiveBrief, snapshotDiff, processingTimeMs };

  } catch (error) {
    const errMsg = (error as Error).message;
    console.error(`[${analysisId}] Failed:`, errMsg);

    db.prepare(`UPDATE analyses SET status = 'failed', error_message = ? WHERE id = ?`).run(errMsg, analysisId);

    throw new Error(`Analysis failed: ${errMsg}`);
  }
}
