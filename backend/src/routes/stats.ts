import { Router } from 'express';
import { getDB } from '../db/schema.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req: any, res) => {
  const db = getDB();
  const userId = req.userId;

  // Total competitors
  const compResult = db.prepare('SELECT COUNT(*) as count FROM competitors WHERE user_id = ?').get(userId) as any;
  const totalCompetitors = compResult?.count || 0;

  // Total analyses
  const analysisResult = db.prepare('SELECT COUNT(*) as count FROM analyses WHERE user_id = ?').get(userId) as any;
  const totalAnalyses = analysisResult?.count || 0;

  // Analyses this month
  const monthResult = db.prepare(`
    SELECT COUNT(*) as count FROM analyses
    WHERE user_id = ? AND created_at >= datetime('now', 'start of month')
  `).get(userId) as any;
  const analysesThisMonth = monthResult?.count || 0;

  // Successful analyses
  const successResult = db.prepare(`
    SELECT COUNT(*) as count FROM analyses WHERE user_id = ? AND status = 'completed'
  `).get(userId) as any;
  const successfulAnalyses = successResult?.count || 0;

  // Average processing time
  const avgResult = db.prepare(`
    SELECT AVG(processing_time_ms) as avg_ms FROM analyses
    WHERE user_id = ? AND status = 'completed' AND processing_time_ms IS NOT NULL
  `).get(userId) as any;
  const avgProcessingTime = avgResult?.avg_ms || 0;

  // Analyses per day (last 30 days)
  const trendData = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM analyses
    WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(userId) as any[];

  // Competitor with most analyses
  const topCompetitor = db.prepare(`
    SELECT c.name, COUNT(a.id) as analysis_count
    FROM competitors c
    LEFT JOIN analyses a ON a.competitor_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY analysis_count DESC
    LIMIT 1
  `).get(userId) as any;

  // Recent analyses (last 5)
  const recentAnalyses = db.prepare(`
    SELECT a.id, a.status, a.created_at, a.completed_at, a.processing_time_ms,
           c.name as competitor_name
    FROM analyses a
    JOIN competitors c ON a.competitor_id = c.id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
    LIMIT 5
  `).all(userId);

  // User plan info
  const user = db.prepare('SELECT plan, analyses_count, analyses_limit FROM users WHERE id = ?').get(userId) as any;

  // Alerts count
  const alertsResult = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE user_id = ? AND is_read = 0').get(userId) as any;
  const unreadAlerts = alertsResult?.count || 0;

  // Risk rating distribution from recent analyses
  const riskDistribution = db.prepare(`
    SELECT
      json_extract(executive_brief, '$.riskRating') as risk,
      COUNT(*) as count
    FROM analyses
    WHERE user_id = ? AND status = 'completed' AND executive_brief IS NOT NULL
    GROUP BY risk
  `).all(userId) as any[];

  res.json({
    totalCompetitors,
    totalAnalyses,
    analysesThisMonth,
    successfulAnalyses,
    avgProcessingTime: Math.round(avgProcessingTime),
    trendData,
    topCompetitor: topCompetitor || null,
    recentAnalyses,
    plan: user?.plan || 'free',
    analysesUsed: user?.analyses_count || 0,
    analysesLimit: user?.analyses_limit || 3,
    unreadAlerts,
    riskDistribution,
  });
});

export default router;
