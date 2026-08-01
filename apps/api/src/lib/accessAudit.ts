/**
 * Access audit logging.
 *
 * Every read performed by an access grant is recorded so the organization
 * owner can invoice the external consumer. Append-only — rows are never
 * updated or deleted.
 */

import type { D1Database } from "@cloudflare/workers-types";

export interface AccessAuditEntry {
  readonly grantId: string;
  readonly organizationId: string;
  readonly agentId?: string;
  readonly method: string;
  readonly path: string;
  readonly rowsReturned: number;
  readonly ip?: string;
  readonly userAgent?: string;
}

export interface AccessAuditRow extends AccessAuditEntry {
  readonly id: string;
  readonly created_at: string;
}

export async function recordAccessAudit(
  db: D1Database,
  entry: AccessAuditEntry
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO access_audit (id, grant_id, organization_id, agent_id, method, path, rows_returned, ip, user_agent, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(
      crypto.randomUUID(),
      entry.grantId,
      entry.organizationId,
      entry.agentId ?? null,
      entry.method,
      entry.path,
      entry.rowsReturned,
      entry.ip ?? null,
      entry.userAgent ? entry.userAgent.slice(0, 512) : null,
      new Date().toISOString()
    )
    .run();
}

export async function listAccessAudit(
  db: D1Database,
  options: {
    readonly organizationId: string;
    readonly grantId?: string;
    readonly agentId?: string;
    readonly limit: number;
    readonly cursor?: string;
  }
): Promise<{ rows: AccessAuditRow[]; nextCursor: string | null }> {
  const where: string[] = ["organization_id = ?1"];
  const params: unknown[] = [options.organizationId];

  if (options.grantId) {
    where.push("grant_id = ?" + (params.length + 1));
    params.push(options.grantId);
  }
  if (options.agentId) {
    where.push("agent_id = ?" + (params.length + 1));
    params.push(options.agentId);
  }
  if (options.cursor) {
    where.push("created_at < ?" + (params.length + 1));
    params.push(options.cursor);
  }

  const rows = await db
    .prepare(
      `SELECT * FROM access_audit
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?${params.length + 1}`
    )
    .bind(...params, options.limit + 1)
    .all<Record<string, unknown>>();

  const hasMore = rows.results.length > options.limit;
  const page = rows.results.slice(0, options.limit);

  return {
    rows: page.map(rowToAuditRow),
    nextCursor: hasMore ? String(page[page.length - 1]?.["created_at"]) : null,
  };
}

export async function summarizeAccessAudit(
  db: D1Database,
  options: {
    readonly organizationId: string;
    readonly from?: string;
    readonly to?: string;
  }
): Promise<
  Array<{
    readonly grant_id: string;
    readonly grant_name: string;
    readonly requests: number;
    readonly rows_returned: number;
    readonly agents_read: string[];
    readonly first_used_at: string | null;
    readonly last_used_at: string | null;
  }>
> {
  const where: string[] = ["a.organization_id = ?1"];
  const params: unknown[] = [options.organizationId];

  if (options.from) {
    where.push("a.created_at >= ?" + (params.length + 1));
    params.push(options.from);
  }
  if (options.to) {
    where.push("a.created_at <= ?" + (params.length + 1));
    params.push(options.to);
  }

  const rows = await db
    .prepare(
      `SELECT
         a.grant_id,
         g.name AS grant_name,
         COUNT(*) AS requests,
         SUM(a.rows_returned) AS rows_returned,
         MIN(a.created_at) AS first_used_at,
         MAX(a.created_at) AS last_used_at
       FROM access_audit a
       JOIN access_grants g ON g.id = a.grant_id
       WHERE ${where.join(" AND ")}
       GROUP BY a.grant_id, g.name
       ORDER BY last_used_at DESC`
    )
    .bind(...params)
    .all<Record<string, unknown>>();

  const summaries: Array<{
    readonly grant_id: string;
    readonly grant_name: string;
    readonly requests: number;
    readonly rows_returned: number;
    readonly agents_read: string[];
    readonly first_used_at: string | null;
    readonly last_used_at: string | null;
  }> = [];

  for (const row of rows.results) {
    const agentRows = await db
      .prepare(
        `SELECT DISTINCT agent_id FROM access_audit
         WHERE grant_id = ?1 AND agent_id IS NOT NULL
         ORDER BY agent_id`
      )
      .bind(String(row["grant_id"]))
      .all<{ agent_id: string }>();

    summaries.push({
      grant_id: String(row["grant_id"]),
      grant_name: String(row["grant_name"] ?? "unknown"),
      requests: Number(row["requests"] ?? 0),
      rows_returned: Number(row["rows_returned"] ?? 0),
      agents_read: agentRows.results.map((r) => r.agent_id),
      first_used_at: row["first_used_at"] ? String(row["first_used_at"]) : null,
      last_used_at: row["last_used_at"] ? String(row["last_used_at"]) : null,
    });
  }

  return summaries;
}

function rowToAuditRow(row: Record<string, unknown>): AccessAuditRow {
  return {
    id: String(row["id"]),
    grantId: String(row["grant_id"]),
    organizationId: String(row["organization_id"]),
    agentId: row["agent_id"] ? String(row["agent_id"]) : undefined,
    method: String(row["method"] ?? "GET"),
    path: String(row["path"] ?? ""),
    rowsReturned: Number(row["rows_returned"] ?? 0),
    ip: row["ip"] ? String(row["ip"]) : undefined,
    userAgent: row["user_agent"] ? String(row["user_agent"]) : undefined,
    created_at: String(row["created_at"]),
  };
}
