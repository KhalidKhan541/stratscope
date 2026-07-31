CREATE TABLE IF NOT EXISTS consent_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'private',
  allowed_use_cases TEXT NOT NULL DEFAULT '[]',
  retention_days INTEGER NOT NULL DEFAULT 30,
  requires_anonymization INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX idx_consent_policies_org ON consent_policies(organization_id);
CREATE INDEX idx_consent_policies_agent ON consent_policies(agent_id);
CREATE INDEX idx_consent_policies_scope ON consent_policies(scope);
