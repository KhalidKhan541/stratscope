import { getDB } from '../db/schema.js';
import { runFullAnalysis, UserProfile } from '../agents/orchestrator.js';

export function startMonitoringCron() {
  // Check every 15 minutes for due monitors
  setInterval(checkMonitors, 15 * 60 * 1000);
  console.log('[Monitor] Cron started (15min interval)');
}

async function checkMonitors() {
  try {
    const db = getDB();
    const now = new Date();

    // Find enabled monitors that are due
    const monitors = db.prepare(`
      SELECT m.*, c.name as competitor_name, c.website_url
      FROM monitoring m
      JOIN competitors c ON m.competitor_id = c.id
      WHERE m.enabled = 1 AND (
        (m.schedule = 'daily' AND (m.last_run IS NULL OR datetime(m.last_run, '+1 day') <= datetime('now')))
        OR (m.schedule = 'weekly' AND (m.last_run IS NULL OR datetime(m.last_run, '+7 days') <= datetime('now')))
        OR (m.schedule = 'monthly' AND (m.last_run IS NULL OR datetime(m.last_run, '+1 month') <= datetime('now')))
      )
    `).all() as any[];

    if (monitors.length === 0) return;

    console.log(`[Monitor] Running ${monitors.length} scheduled monitors`);

    for (const monitor of monitors) {
      try {
        // Default user profile for monitoring (can be enhanced later)
        const userProfile: UserProfile = {
          businessDescription: 'Tracked competitor',
          targetAudience: 'General',
          pricing: 'Unknown',
          strengths: 'Unknown',
        };

        await runFullAnalysis(
          monitor.user_id,
          monitor.competitor_id,
          monitor.website_url,
          monitor.competitor_name,
          userProfile
        );

        // Update last_run
        db.prepare('UPDATE monitoring SET last_run = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?')
          .run(monitor.id);

        // Create alert
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        db.prepare('INSERT INTO alerts (id, user_id, competitor_id, alert_type, message) VALUES (?, ?, ?, ?, ?)')
          .run(
            alertId,
            monitor.user_id,
            monitor.competitor_id,
            'monitoring',
            `Automated analysis completed for ${monitor.competitor_name}`
          );

        console.log(`[Monitor] Completed analysis for ${monitor.competitor_name}`);
      } catch (err) {
        console.error(`[Monitor] Failed for ${monitor.competitor_name}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.error('[Monitor] Cron error:', (err as Error).message);
  }
}
