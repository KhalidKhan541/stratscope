CREATE TABLE IF NOT EXISTS benchmark_reports (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  period TEXT NOT NULL,
  stats TEXT NOT NULL DEFAULT '{}',
  computed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_reports_agent_period ON benchmark_reports (agent_id, period);
CREATE INDEX IF NOT EXISTS idx_benchmark_reports_org_period ON benchmark_reports (organization_id, period);
