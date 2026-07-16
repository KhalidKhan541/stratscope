import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/schema.js';
import { z } from 'zod';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'stratscope-dev-secret';

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1) });
const loginSchema = z.object({ email: z.string().email(), password: z.string() });

function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const id = uuid();
    const hash = await bcrypt.hash(password, 10);
    const plan = 'free';
    const limit = 3;

    db.prepare('INSERT INTO users (id, email, password_hash, name, plan, analyses_limit) VALUES (?, ?, ?, ?, ?, ?)').run(id, email, hash, name, plan, limit);

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id, email, name, plan }, token });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, plan: user.plan }, token });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, (req: any, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, email, name, plan, analyses_count, analyses_limit, onboarding_completed, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.post('/complete-onboarding', authMiddleware, (req: any, res) => {
  const db = getDB();
  db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(req.userId);
  res.json({ success: true });
});

export default router;
export { authMiddleware };
