import { Router } from 'express';
import Stripe from 'stripe';
import { getDB } from '../db/schema.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
}

// Price IDs mapping — replace with your actual Stripe price IDs
const PLAN_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || 'price_starter_monthly',
    yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || 'price_starter_yearly',
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
  },
  enterprise: {
    monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_monthly',
    yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_yearly',
  },
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 25,
  pro: 100,
  enterprise: -1,
};

// Create Stripe Checkout Session
router.post('/checkout', async (req: any, res) => {
  try {
    const { plan, interval = 'monthly' } = req.body;
    if (!PLAN_PRICES[plan]) return res.status(400).json({ error: 'Invalid plan' });

    const stripe = getStripe();
    const db = getDB();
    const user = db.prepare('SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?').get(req.userId) as any;

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }

    const priceId = PLAN_PRICES[plan][interval as 'monthly' | 'yearly'];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`,
      metadata: { userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create Customer Portal session
router.post('/portal', async (req: any, res) => {
  try {
    const stripe = getStripe();
    const db = getDB();
    const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.userId) as any;

    if (!user.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Portal error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Get subscription status
router.get('/status', async (req: any, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT plan, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?').get(req.userId) as any;

    if (!user.stripe_subscription_id) {
      return res.json({ status: 'none', plan: user.plan, subscriptionId: null });
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

    res.json({
      status: subscription.status,
      plan: user.plan,
      subscriptionId: subscription.id,
      currentPeriodEnd: (subscription as any).current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (err) {
    res.json({ status: 'unknown', plan: (req as any).user?.plan || 'free', subscriptionId: null });
  }
});

// Stripe Webhook (must use raw body — registered separately in server.ts)
export function registerStripeWebhook(app: any) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log('[Stripe] No webhook secret configured, webhooks disabled');
    return;
  }

  app.post('/api/stripe/webhook', async (req: any, res) => {
    try {
      const stripe = getStripe();
      const sig = req.headers['stripe-signature'];
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

      console.log(`[Stripe Webhook] Received: ${event.type}`);

      const db = getDB();

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          db.prepare('UPDATE users SET plan = ?, analyses_limit = ?, stripe_subscription_id = ? WHERE id = ?')
            .run(plan, PLAN_LIMITS[plan] || 3, session.subscription, userId);
          console.log(`[Stripe] User ${userId} upgraded to ${plan}`);
        }
      }

      if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          if (sub.status === 'canceled' || sub.status === 'unpaid') {
            db.prepare('UPDATE users SET plan = ?, analyses_limit = ? WHERE id = ?')
              .run('free', 3, userId);
          }
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          db.prepare('UPDATE users SET plan = ?, analyses_limit = ?, stripe_subscription_id = NULL WHERE id = ?')
            .run('free', 3, userId);
          console.log(`[Stripe] User ${userId} subscription canceled, reverted to free`);
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error('[Stripe Webhook] Error:', (err as Error).message);
      res.status(400).json({ error: 'Webhook error' });
    }
  });
}

export default router;
