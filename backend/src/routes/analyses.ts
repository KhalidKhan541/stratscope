import { Router } from 'express';
import { getDB } from '../db/schema.js';
import { authMiddleware } from './auth.js';
import { runFullAnalysis, UserProfile } from '../agents/orchestrator.js';
import { getProgress } from '../services/progress.js';
import { generateReportPdf } from '../services/pdf-generator.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const analysisSchema = z.object({
  competitorId: z.string(),
  businessDescription: z.string().min(10),
  targetAudience: z.string().min(3),
  pricing: z.string().min(1),
  strengths: z.string().min(3),
});

router.post('/', async (req: any, res) => {
  try {
    const body = analysisSchema.parse(req.body);
    const db = getDB();

    const user = db.prepare('SELECT analyses_count, analyses_limit FROM users WHERE id = ?').get(req.userId) as any;
    if (user.analyses_count >= user.analyses_limit) {
      return res.status(403).json({ error: 'Analysis limit reached. Upgrade your plan.' });
    }

    const competitor = db.prepare('SELECT * FROM competitors WHERE id = ? AND user_id = ?').get(body.competitorId, req.userId) as any;
    if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

    const userProfile: UserProfile = {
      businessDescription: body.businessDescription,
      targetAudience: body.targetAudience,
      pricing: body.pricing,
      strengths: body.strengths,
    };

    const result = await runFullAnalysis(req.userId, competitor.id, competitor.website_url, competitor.name, userProfile);

    res.json({ analysis: result });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/', (req: any, res) => {
  const db = getDB();
  const analyses = db.prepare(`
    SELECT a.*, c.name as competitor_name, c.website_url
    FROM analyses a
    JOIN competitors c ON a.competitor_id = c.id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
  `).all(req.userId);
  res.json({ analyses });
});

router.get('/:id', (req: any, res) => {
  const db = getDB();
  const analysis = db.prepare(`
    SELECT a.*, c.name as competitor_name, c.website_url
    FROM analyses a
    JOIN competitors c ON a.competitor_id = c.id
    WHERE a.id = ? AND a.user_id = ?
  `).get(req.params.id, req.userId);

  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

  const a = analysis as any;
  res.json({
    analysis: {
      ...a,
      extracted_patterns: JSON.parse(a.extracted_patterns || '{}'),
      psychological_profile: JSON.parse(a.psychological_profile || '{}'),
      strategic_options: JSON.parse(a.strategic_options || '{}'),
      executive_brief: JSON.parse(a.executive_brief || '{}'),
      snapshot_diff: JSON.parse(a.snapshot_diff || '{}'),
    }
  });
});

// SSE endpoint for real-time progress
router.get('/:id/progress', (req: any, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const analysisId = req.params.id;
  let lastStep = 0;

  const interval = setInterval(() => {
    const progress = getProgress(analysisId);
    const newSteps = progress.filter(p => p.step > lastStep);

    for (const step of newSteps) {
      res.write(`data: ${JSON.stringify({ step: step.step, message: step.message })}\n\n`);
      lastStep = step.step;
    }

    // Check if analysis is complete
    const db = getDB();
    const analysis = db.prepare('SELECT status FROM analyses WHERE id = ?').get(analysisId) as any;
    if (analysis && (analysis.status === 'completed' || analysis.status === 'failed')) {
      res.write(`data: ${JSON.stringify({ step: 6, message: analysis.status === 'completed' ? 'Analysis complete!' : 'Analysis failed', status: analysis.status })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// PDF export endpoint
router.get('/:id/pdf', async (req: any, res) => {
  try {
    const db = getDB();
    const analysis = db.prepare(`
      SELECT a.*, c.name as competitor_name, c.website_url
      FROM analyses a
      JOIN competitors c ON a.competitor_id = c.id
      WHERE a.id = ? AND a.user_id = ?
    `).get(req.params.id, req.userId) as any;

    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    if (analysis.status !== 'completed') return res.status(400).json({ error: 'Analysis not completed yet' });

    const analysisData = {
      competitor_name: analysis.competitor_name,
      website_url: analysis.website_url,
      created_at: analysis.created_at,
      processing_time_ms: analysis.processing_time_ms,
      executive_brief: JSON.parse(analysis.executive_brief || '{}'),
      extracted_patterns: JSON.parse(analysis.extracted_patterns || '{}'),
      psychological_profile: JSON.parse(analysis.psychological_profile || '{}'),
      strategic_options: JSON.parse(analysis.strategic_options || '{}'),
      snapshot_diff: JSON.parse(analysis.snapshot_diff || '{}'),
    };

    console.log(`[PDF] Generating PDF for analysis ${req.params.id}...`);
    const pdfBuffer = await generateReportPdf(analysisData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${analysis.competitor_name}-analysis.pdf"`);
    res.send(pdfBuffer);
    console.log(`[PDF] PDF generated: ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.error('[PDF] Generation failed:', (err as Error).message);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

export default router;
