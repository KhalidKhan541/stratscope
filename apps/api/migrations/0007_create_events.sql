CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  service TEXT,
  payload TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  schema_version TEXT NOT NULL DEFAULT '1.0',
  FOREIGN KEY (execution_id) REFERENCES executions(id)
);

CREATE INDEX idx_events_execution_id ON events(execution_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_execution_event ON events(execution_id, event_type);
