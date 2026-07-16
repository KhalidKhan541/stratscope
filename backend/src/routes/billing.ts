import { Router } from 'express';
import { getDB } from '../db/schema.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const PLANS = {
  free: { name: 'Free', price: 0, analysesLimit: 3, features: ['3 analyses/month', 'Basic reports'] },
  starter: { name: 'Starter', price: 49, analysesLimit: 25, features: ['25 analyses/month', 'Full reports', 'Email alerts'] },
  pro: { name: 'Pro', price: 149, analysesLimit: 100, features: ['100 analyses/month', 'Full reports', 'Real-time alerts', 'Export PDF', 'Priority support'] },
  enterprise: { name: 'Enterprise', price: 499, analysesLimit: -1, features: ['Unlimited analyses', 'Full reports', 'Real-time alerts', 'Export PDF', 'API access', 'Dedicated support'] },
};

router.get('/plans', (_req, res) => { res.json({ plans: PLANS }); });

router.get('/usage', (req: any, res) => {
  const db = getDB();
  const user = db.prepare('SELECT plan, analyses_count, analyses_limit FROM users WHERE id = ?').get(req.userId) as any;
  res.json({ plan: user.plan, analysesCount: user.analyses_count, analysesLimit: user.analyses_limit, planDetails: PLANS[user.plan as keyof typeof PLANS] });
});

router.post('/upgrade', (req: any, res) => {
  const { plan } = req.body;
  if (!PLANS[plan as keyof typeof PLANS]) return res.status(400).json({ error: 'Invalid plan' });

  const db = getDB();
  const limit = PLANS[plan as keyof typeof PLANS].analysesLimit;
  db.prepare('UPDATE users SET plan = ?, analyses_limit = ? WHERE id = ?').run(plan, limit, req.userId);
  res.json({ success: true, plan, analysesLimit: limit });
});

export default router;
