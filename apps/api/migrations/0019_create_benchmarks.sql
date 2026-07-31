-- Benchmarks: Standardized comparisons of models, tools, or workflows.
CREATE TABLE IF NOT EXISTS benchmarks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  benchmark_type TEXT NOT NULL CHECK (benchmark_type IN (
    'model_comparison', 'tool_comparison', 'latency_comparison',
    'cost_comparison', 'success_rate', 'hallucination_rate',
    'agent_comparison', 'execution_quality'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'failed')),
  entries TEXT NOT NULL DEFAULT '[]',
  dataset_id TEXT REFERENCES datasets(id),
  config TEXT NOT NULL DEFAULT '{}',
  results TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_organization ON benchmarks(organization_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_project ON benchmarks(project_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_type ON benchmarks(benchmark_type);
CREATE INDEX IF NOT EXISTS idx_benchmarks_status ON benchmarks(status);
CREATE INDEX IF NOT EXISTS idx_benchmarks_dataset ON benchmarks(dataset_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_created ON benchmarks(created_at);
