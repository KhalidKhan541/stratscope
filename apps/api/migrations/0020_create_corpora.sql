-- Corpora: Curated collections of datasets and benchmarks for research.
CREATE TABLE IF NOT EXISTS corpora (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  dataset_ids TEXT NOT NULL DEFAULT '[]',
  benchmark_ids TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_corpora_organization ON corpora(organization_id);
CREATE INDEX IF NOT EXISTS idx_corpora_project ON corpora(project_id);
CREATE INDEX IF NOT EXISTS idx_corpora_status ON corpora(status);
CREATE INDEX IF NOT EXISTS idx_corpora_created ON corpora(created_at);
