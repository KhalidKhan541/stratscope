-- Dataset versions: Immutable version history for datasets.
CREATE TABLE IF NOT EXISTS dataset_versions (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES datasets(id),
  version INTEGER NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  schema_definition TEXT NOT NULL DEFAULT '{}',
  storage_path TEXT,
  checksum TEXT,
  change_summary TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dataset_versions_unique ON dataset_versions(dataset_id, version);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset ON dataset_versions(dataset_id);
