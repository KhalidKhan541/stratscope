-- Research agents: Internal agents that generate execution intelligence.
CREATE TABLE IF NOT EXISTS research_agents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'research', 'coding', 'browser', 'qa', 'planning', 'documentation', 'evaluation'
  )),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_execution_at TEXT,
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_agents_organization ON research_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_research_agents_type ON research_agents(agent_type);
