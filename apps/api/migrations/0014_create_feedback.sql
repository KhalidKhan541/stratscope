CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  user_id TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  category TEXT,
  resolved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES executions(id)
);

CREATE INDEX idx_feedback_execution_id ON feedback(execution_id);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_category ON feedback(category);
CREATE INDEX idx_feedback_resolved ON feedback(resolved);
