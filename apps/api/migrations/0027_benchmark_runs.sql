CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  benchmark_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  dataset_version_id TEXT,
  metrics TEXT NOT NULL DEFAULT '[]',
  execution_count INTEGER NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL NOT NULL DEFAULT 0,
  error_rate REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX idx_benchmark_runs_benchmark ON benchmark_runs(benchmark_id);
CREATE INDEX idx_benchmark_runs_org ON benchmark_runs(organization_id);
CREATE INDEX idx_benchmark_runs_status ON benchmark_runs(status);
