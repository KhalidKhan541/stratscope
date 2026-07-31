-- Datasets: Versioned collections of execution intelligence records for research.
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN (
    'failure', 'reasoning', 'tool_selection', 'model_routing',
    'prompt_improvement', 'reflection', 'evaluation', 'knowledge',
    'coding', 'planning', 'research'
  )),
  status TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building', 'validating', 'ready', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  parent_dataset_id TEXT REFERENCES datasets(id),
  record_count INTEGER NOT NULL DEFAULT 0,
  schema_definition TEXT NOT NULL DEFAULT '{}',
  filters TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  export_formats TEXT NOT NULL DEFAULT '["jsonl","csv"]',
  storage_path TEXT,
  checksum TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_datasets_organization ON datasets(organization_id);
CREATE INDEX IF NOT EXISTS idx_datasets_project ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_datasets_category ON datasets(category);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_parent ON datasets(parent_dataset_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created ON datasets(created_at);
