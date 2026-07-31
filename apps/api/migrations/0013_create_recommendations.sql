CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  confidence REAL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'applied')),
  evidence TEXT DEFAULT '[]',
  expected_impact TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES executions(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_recommendations_project_id ON recommendations(project_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_priority ON recommendations(priority);
CREATE INDEX idx_recommendations_execution_id ON recommendations(execution_id);
CREATE INDEX idx_recommendations_created_at ON recommendations(created_at);
