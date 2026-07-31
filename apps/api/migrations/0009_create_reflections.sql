CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  summary TEXT,
  strengths TEXT DEFAULT '[]',
  weaknesses TEXT DEFAULT '[]',
  recommendations TEXT DEFAULT '[]',
  confidence REAL,
  reflection_model TEXT,
  reasoning TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES executions(id)
);

CREATE INDEX idx_reflections_execution_id ON reflections(execution_id);
CREATE INDEX idx_reflections_created_at ON reflections(created_at);
