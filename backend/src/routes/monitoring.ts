import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/schema.js';
import { authMiddleware } from './auth.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// Get all monitors for user
router.get('/', (req: any, res) => {
  const db = getDB();
  const monitors = db.prepare(`
    SELECT m.*, c.name as competitor_name, c.website_url
    FROM monitoring m
    JOIN competitors c ON m.competitor_id = c.id
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
  `).all(req.userId);
  res.json({ monitors });
});

// Create/update monitor
const monitorSchema = z.object({
  competitorId: z.string(),
  schedule: z.enum(['daily', 'weekly', 'monthly']),
  enabled: z.boolean().optional().default(true),
});

router.post('/', (req: any, res) => {
  try {
    const body = monitorSchema.parse(req.body);
    const db = getDB();

    // Verify competitor belongs to user
    const competitor = db.prepare('SELECT id FROM competitors WHERE id = ? AND user_id = ?').get(body.competitorId, req.userId);
    if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

    // Check if monitor already exists
    const existing = db.prepare('SELECT id FROM monitoring WHERE competitor_id = ? AND user_id = ?').get(body.competitorId, req.userId) as any;

    if (existing) {
      db.prepare('UPDATE monitoring SET schedule = ?, enabled = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(body.schedule, body.enabled ? 1 : 0, existing.id);
      const updated = db.prepare('SELECT * FROM monitoring WHERE id = ?').get(existing.id);
      return res.json({ monitor: updated });
    }

    const id = uuid();
    db.prepare('INSERT INTO monitoring (id, user_id, competitor_id, schedule, enabled) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.userId, body.competitorId, body.schedule, body.enabled ? 1 : 0);

    const monitor = db.prepare('SELECT * FROM monitoring WHERE id = ?').get(id);
    res.json({ monitor });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Failed to save monitor' });
  }
});

// Toggle monitor
router.patch('/:id/toggle', (req: any, res) => {
  const db = getDB();
  const monitor = db.prepare('SELECT * FROM monitoring WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

  const newEnabled = monitor.enabled ? 0 : 1;
  db.prepare('UPDATE monitoring SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newEnabled, req.params.id);
  res.json({ enabled: !!newEnabled });
});

// Delete monitor
router.delete('/:id', (req: any, res) => {
  const db = getDB();
  db.prepare('DELETE FROM monitoring WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

// Get alerts
router.get('/alerts', (req: any, res) => {
  const db = getDB();
  const alerts = db.prepare(`
    SELECT a.*, c.name as competitor_name
    FROM alerts a
    JOIN competitors c ON a.competitor_id = c.id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all(req.userId);
  res.json({ alerts });
});

// Mark alert as read
router.patch('/alerts/:id/read', (req: any, res) => {
  const db = getDB();
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

export default router;
