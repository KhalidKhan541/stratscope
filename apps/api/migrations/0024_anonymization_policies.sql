CREATE TABLE IF NOT EXISTS anonymization_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  fields TEXT NOT NULL DEFAULT '[]',
  epsilon REAL,
  delta REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX idx_anonymization_policies_org ON anonymization_policies(organization_id);
