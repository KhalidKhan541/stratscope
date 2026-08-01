-- Access grants: read-only credentials issued to external data consumers (e.g. Magma).
-- The credential is shown once at issuance; only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  agent_ids TEXT NOT NULL DEFAULT '[]',
  credential_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  revoked_by TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX idx_access_grants_org ON access_grants(organization_id);
CREATE INDEX idx_access_grants_hash ON access_grants(credential_hash);
CREATE INDEX idx_access_grants_status ON access_grants(status);

-- Access audit log: every read performed by a grant, for invoicing.
CREATE TABLE IF NOT EXISTS access_audit (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  agent_id TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  rows_returned INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (grant_id) REFERENCES access_grants(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX idx_access_audit_grant ON access_audit(grant_id);
CREATE INDEX idx_access_audit_org ON access_audit(organization_id);
CREATE INDEX idx_access_audit_agent ON access_audit(agent_id);
CREATE INDEX idx_access_audit_created ON access_audit(created_at);
