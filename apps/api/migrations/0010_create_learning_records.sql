CREATE TABLE IF NOT EXISTS learning_records (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern TEXT,
  frequency INTEGER DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  suggestion TEXT,
  evidence TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES executions(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_learning_records_project_id ON learning_records(project_id);
CREATE INDEX idx_learning_records_pattern_type ON learning_records(pattern_type);
CREATE INDEX idx_learning_records_severity ON learning_records(severity);
CREATE INDEX idx_learning_records_created_at ON learning_records(created_at);
