import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDB } from './db/schema.js';
import authRoutes from './routes/auth.js';
import competitorRoutes from './routes/competitors.js';
import analysisRoutes from './routes/analyses.js';
import billingRoutes from './routes/billing.js';
import statsRoutes from './routes/stats.js';
import monitoringRoutes from './routes/monitoring.js';
import stripeRoutes, { registerStripeWebhook } from './routes/stripe.js';
import { startMonitoringCron } from './services/monitoring-cron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));

// Stripe webhook needs raw body (before JSON middleware)
registerStripeWebhook(app);

app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use('/api/auth', authRoutes);
app.use('/api/competitors', competitorRoutes);
app.use('/api/analyses', analysisRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/monitoring', monitoringRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await initDB();
  startMonitoringCron();
  app.listen(PORT, () => {
    console.log(`StratScope API running on port ${PORT}`);
    console.log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured (add STRIPE_SECRET_KEY to .env)'}`);
  });
}

start();

export default app;
