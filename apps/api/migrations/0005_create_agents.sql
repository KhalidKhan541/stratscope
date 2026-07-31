CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  framework TEXT CHECK (framework IN ('langgraph', 'crewai', 'autogen', 'openai_sdk', 'custom')),
  provider TEXT,
  model TEXT,
  version TEXT,
  config TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_agents_project_id ON agents(project_id);
CREATE INDEX idx_agents_framework ON agents(framework);
CREATE INDEX idx_agents_deleted_at ON agents(deleted_at) WHERE deleted_at IS NOT NULL;
