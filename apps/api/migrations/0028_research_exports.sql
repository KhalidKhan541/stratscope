CREATE TABLE IF NOT EXISTS research_exports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  dataset_id TEXT,
  benchmark_id TEXT,
  format TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_research_exports_org ON research_exports(organization_id);
