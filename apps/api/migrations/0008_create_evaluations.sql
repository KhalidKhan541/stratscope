CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  accuracy REAL,
  goal_completion REAL,
  hallucination_score REAL,
  confidence REAL,
  cost_efficiency REAL,
  latency_score REAL,
  safety_score REAL,
  evaluation_model TEXT,
  summary TEXT,
  details TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES executions(id)
);

CREATE INDEX idx_evaluations_execution_id ON evaluations(execution_id);
CREATE INDEX idx_evaluations_created_at ON evaluations(created_at);
