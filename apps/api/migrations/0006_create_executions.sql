CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'accepted', 'running', 'completed', 'failed', 'cancelled', 'archived')),
  model TEXT,
  provider TEXT,
  trace_id TEXT,
  parent_execution_id TEXT,
  pipeline_version TEXT,
  sdk_version TEXT,
  started_at TEXT,
  completed_at TEXT,
  latency_ms INTEGER,
  queue_latency_ms INTEGER,
  processing_latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost REAL,
  input_ref TEXT,
  output_ref TEXT,
  metadata TEXT DEFAULT '{}',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (parent_execution_id) REFERENCES executions(id)
);

CREATE INDEX idx_executions_organization_id ON executions(organization_id);
CREATE INDEX idx_executions_project_id ON executions(project_id);
CREATE INDEX idx_executions_agent_id ON executions(agent_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_trace_id ON executions(trace_id);
CREATE INDEX idx_executions_started_at ON executions(started_at);
CREATE INDEX idx_executions_created_at ON executions(created_at);
CREATE INDEX idx_executions_parent_execution_id ON executions(parent_execution_id);
