import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/schema.js';
import { authMiddleware } from './auth.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const competitorSchema = z.object({ name: z.string().min(1), websiteUrl: z.string().url(), description: z.string().optional() });

router.get('/', (req: any, res) => {
  const db = getDB();
  const competitors = db.prepare('SELECT * FROM competitors WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ competitors });
});

router.post('/', (req: any, res) => {
  try {
    const { name, websiteUrl, description } = competitorSchema.parse(req.body);
    const db = getDB();
    const id = uuid();
    db.prepare('INSERT INTO competitors (id, user_id, name, website_url, description) VALUES (?, ?, ?, ?, ?)').run(id, req.userId, name, websiteUrl, description || '');
    const competitor = db.prepare('SELECT * FROM competitors WHERE id = ?').get(id);
    res.json({ competitor });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Failed to add competitor' });
  }
});

router.delete('/:id', (req: any, res) => {
  const db = getDB();
  db.prepare('DELETE FROM competitors WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

router.get('/:id/snapshots', (req: any, res) => {
  const db = getDB();
  const snapshots = db.prepare('SELECT * FROM snapshots WHERE competitor_id = ? ORDER BY scraped_at DESC').all(req.params.id);
  res.json({ snapshots });
});

export default router;
