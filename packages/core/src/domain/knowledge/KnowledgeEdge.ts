/**
 * Knowledge edge - a directed connection between knowledge nodes.
 *
 * Edges represent relationships between knowledge entities, forming
 * the graph structure of the knowledge base.
 */

import type {
  KnowledgeEdgeId,
  KnowledgeNodeId,
  OrganizationId,
  ProjectId,
} from "../../shared/ids/Ids";

/** The type of relationship between knowledge nodes. */
export type KnowledgeEdgeType =
  | "causes"
  | "correlates_with"
  | "depends_on"
  | "conflicts_with"
  | "enhances"
  | "diminishes"
  | "precedes"
  | "follows"
  | "is_instance_of"
  | "generalizes";

/** The canonical knowledge edge record. */
export interface KnowledgeEdge {
  /** Unique identifier for this knowledge edge. */
  readonly edge_id: KnowledgeEdgeId;
  /** Organization this knowledge belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this knowledge belongs to. */
  readonly project_id: ProjectId;
  /** Source node ID. */
  readonly source_node_id: KnowledgeNodeId;
  /** Target node ID. */
  readonly target_node_id: KnowledgeNodeId;
  /** Type of relationship. */
  readonly type: KnowledgeEdgeType;
  /** Weight/strength of this relationship (0.0 to 1.0). */
  readonly weight: number;
  /** Confidence in this relationship (0.0 to 1.0). */
  readonly confidence: number;
  /** Number of evidence instances supporting this edge. */
  readonly evidence_count: number;
  /** Structured properties of this relationship. */
  readonly properties: Record<string, unknown>;
  /** ISO-8601 timestamp when this edge was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this edge was last updated. */
  readonly updated_at: string;
}

/**
 * Creates a new KnowledgeEdge record.
 */
export function createKnowledgeEdge(overrides: {
  edge_id: KnowledgeEdgeId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  source_node_id: KnowledgeNodeId;
  target_node_id: KnowledgeNodeId;
  type: KnowledgeEdgeType;
  weight?: number;
  confidence?: number;
  properties?: Record<string, unknown>;
}): KnowledgeEdge {
  const now = new Date().toISOString();
  return {
    edge_id: overrides.edge_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    source_node_id: overrides.source_node_id,
    target_node_id: overrides.target_node_id,
    type: overrides.type,
    weight: overrides.weight ?? 0.5,
    confidence: overrides.confidence ?? 0.5,
    evidence_count: 1,
    properties: overrides.properties ?? {},
    created_at: now,
    updated_at: now,
  };
}
