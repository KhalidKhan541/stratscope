interface IAnalyticsService {
  getOverview(organizationId: string): Promise<{
    total_executions: number;
    success_rate: number;
    average_latency_ms: number;
    total_cost: number;
    total_tokens: number;
    active_projects: number;
  }>;
  getCostBreakdown(organizationId: string, options: { period?: string }): Promise<readonly Record<string, unknown>[]>;
  getLatencyBreakdown(organizationId: string, options: { period?: string }): Promise<readonly Record<string, unknown>[]>;
  getTokenUsage(organizationId: string, options: { period?: string }): Promise<readonly Record<string, unknown>[]>;
}

export class AnalyticsService implements IAnalyticsService {
  constructor(private readonly db: D1Database) {}

  async getOverview(organizationId: string) {
    const [total, completed, failed, projects] = await Promise.all([
      this.db.prepare(`SELECT COUNT(*) as count FROM executions WHERE organization_id = ?`).bind(organizationId).first(),
      this.db.prepare(`SELECT COUNT(*) as count FROM executions WHERE organization_id = ? AND status = 'completed'`).bind(organizationId).first(),
      this.db.prepare(`SELECT COUNT(*) as count FROM executions WHERE organization_id = ? AND status = 'failed'`).bind(organizationId).first(),
      this.db.prepare(`SELECT COUNT(DISTINCT id) as count FROM projects WHERE organization_id = ?`).bind(organizationId).first(),
    ]);

    const totals = await this.db.prepare(
      `SELECT AVG(latency_ms) as avg_latency, SUM(estimated_cost) as total_cost, SUM(total_tokens) as total_tokens
       FROM executions WHERE organization_id = ? AND status = 'completed'`
    ).bind(organizationId).first();

    const totalExecutions = (total?.count as number) ?? 0;
    const completedExecutions = (completed?.count as number) ?? 0;

    return {
      total_executions: totalExecutions,
      success_rate: totalExecutions > 0 ? completedExecutions / totalExecutions : 0,
      average_latency_ms: (totals?.avg_latency as number) ?? 0,
      total_cost: (totals?.total_cost as number) ?? 0,
      total_tokens: (totals?.total_tokens as number) ?? 0,
      active_projects: (projects?.count as number) ?? 0,
    };
  }

  async getCostBreakdown(organizationId: string) {
    const rows = await this.db.prepare(
      `SELECT model, provider, COUNT(*) as execution_count, SUM(estimated_cost) as total_cost, AVG(estimated_cost) as avg_cost
       FROM executions WHERE organization_id = ? AND status = 'completed'
       GROUP BY model, provider ORDER BY total_cost DESC`
    ).bind(organizationId).all();

    return rows.results ?? [];
  }

  async getLatencyBreakdown(organizationId: string) {
    const rows = await this.db.prepare(
      `SELECT model, provider, COUNT(*) as execution_count, AVG(latency_ms) as avg_latency, MIN(latency_ms) as min_latency, MAX(latency_ms) as max_latency
       FROM executions WHERE organization_id = ? AND status = 'completed'
       GROUP BY model, provider ORDER BY avg_latency ASC`
    ).bind(organizationId).all();

    return rows.results ?? [];
  }

  async getTokenUsage(organizationId: string) {
    const rows = await this.db.prepare(
      `SELECT model, provider, COUNT(*) as execution_count, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(total_tokens) as total_tokens
       FROM executions WHERE organization_id = ? AND status = 'completed'
       GROUP BY model, provider ORDER BY total_tokens DESC`
    ).bind(organizationId).all();

    return rows.results ?? [];
  }
}
