-- Dataset exports: Tracks export jobs for datasets in various formats.
CREATE TABLE IF NOT EXISTS dataset_exports (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES datasets(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  format TEXT NOT NULL CHECK (format IN ('jsonl', 'parquet', 'csv', 'arrow', 'rest')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  storage_path TEXT,
  file_size_bytes INTEGER,
  record_count INTEGER,
  checksum TEXT,
  error TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dataset_exports_dataset ON dataset_exports(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_exports_organization ON dataset_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_dataset_exports_status ON dataset_exports(status);
