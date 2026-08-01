import type { Env } from "../workers/env.js";

interface AgentStats {
  readonly agent_id: string;
  readonly agent_name: string | null;
  readonly project_id: string;
  readonly organization_id: string;
  readonly total_executions: number;
  readonly completed: number;
  readonly failed: number;
  readonly success_rate: number;
  readonly avg_latency_ms: number;
  readonly total_cost_usd: number;
  readonly avg_cost_usd: number;
  readonly total_tokens: number;
}

interface MutableAgentStats {
  agent_id: string;
  agent_name: string | null;
  project_id: string;
  organization_id: string;
  total_executions: number;
  completed: number;
  failed: number;
  success_rate: number;
  avg_latency_ms: number;
  total_cost_usd: number;
  avg_cost_usd: number;
  total_tokens: number;
}

interface BenchmarkReport {
  readonly agent_id: string;
  readonly organization_id: string;
  readonly period: string;
  readonly stats: AgentStats;
  readonly computed_at: string;
}

function periodKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
}

export async function generateBenchmarkReports(env: Env): Promise<BenchmarkReport[]> {
  if (!env.DB) {
    throw new Error("Database unavailable");
  }

  const period = periodKey();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const agents = await env.DB.prepare(
    `SELECT DISTINCT agent_id, organization_id, project_id
     FROM executions
     WHERE created_at >= ?1`
  )
    .bind(since)
    .all<{ agent_id: string; organization_id: string; project_id: string }>();

  if (!agents.results || agents.results.length === 0) {
    return [];
  }

  const reports: BenchmarkReport[] = [];

  for (const agent of agents.results) {
    const rows = await env.DB.prepare(
      `SELECT
         COUNT(*) AS total_executions,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         AVG(latency_ms) AS avg_latency_ms,
         SUM(estimated_cost) AS total_cost_usd,
         SUM(total_tokens) AS total_tokens
       FROM executions
       WHERE agent_id = ?1 AND created_at >= ?2`
    )
      .bind(agent.agent_id, since)
      .first<{
        total_executions: number;
        completed: number;
        failed: number;
        avg_latency_ms: number | null;
        total_cost_usd: number | null;
        total_tokens: number | null;
      }>();

    if (!rows || !rows.total_executions) {
      continue;
    }

    const total = rows.total_executions;
    const completed = rows.completed ?? 0;

    const stats: MutableAgentStats = {
      agent_id: agent.agent_id,
      agent_name: null,
      project_id: agent.project_id,
      organization_id: agent.organization_id,
      total_executions: total,
      completed,
      failed: rows.failed ?? 0,
      success_rate: total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0,
      avg_latency_ms: rows.avg_latency_ms ? Math.round(rows.avg_latency_ms) : 0,
      total_cost_usd: rows.total_cost_usd ? Number(rows.total_cost_usd.toFixed(6)) : 0,
      avg_cost_usd: total > 0 && rows.total_cost_usd ? Number((rows.total_cost_usd / total).toFixed(6)) : 0,
      total_tokens: rows.total_tokens ?? 0,
    };

    const agentInfo = await env.DB.prepare(
      `SELECT name FROM agents WHERE id = ?1 AND deleted_at IS NULL`
    )
      .bind(agent.agent_id)
      .first<{ name: string }>();

    stats.agent_name = agentInfo?.name ?? agent.agent_id;

    const report: BenchmarkReport = {
      agent_id: agent.agent_id,
      organization_id: agent.organization_id,
      period,
      stats,
      computed_at: new Date().toISOString(),
    };

    const existing = await env.DB.prepare(
      `SELECT id FROM benchmark_reports WHERE agent_id = ?1 AND period = ?2`
    )
      .bind(agent.agent_id, period)
      .first<{ id: string }>();

    const now = new Date().toISOString();

    if (existing) {
      await env.DB.prepare(
        `UPDATE benchmark_reports
         SET stats = ?1, computed_at = ?2, updated_at = ?2
         WHERE id = ?3`
      )
        .bind(JSON.stringify(stats), now, existing.id)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO benchmark_reports (id, agent_id, organization_id, project_id, period, stats, computed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          agent.agent_id,
          agent.organization_id,
          agent.project_id,
          period,
          JSON.stringify(stats),
          now,
          now,
          now
        )
        .run();
    }

    reports.push(report);
  }

  return reports;
}
