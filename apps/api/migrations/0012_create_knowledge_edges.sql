CREATE TABLE IF NOT EXISTS knowledge_edges (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  properties TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_node_id) REFERENCES knowledge_nodes(id),
  FOREIGN KEY (target_node_id) REFERENCES knowledge_nodes(id)
);

CREATE INDEX idx_knowledge_edges_source_node_id ON knowledge_edges(source_node_id);
CREATE INDEX idx_knowledge_edges_target_node_id ON knowledge_edges(target_node_id);
CREATE INDEX idx_knowledge_edges_edge_type ON knowledge_edges(edge_type);
CREATE INDEX idx_knowledge_edges_source_target ON knowledge_edges(source_node_id, target_node_id);
