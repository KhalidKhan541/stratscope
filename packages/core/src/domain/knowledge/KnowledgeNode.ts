/**
 * Knowledge node - a vertex in the knowledge graph.
 *
 * Knowledge nodes represent entities, concepts, or patterns extracted
 * from execution history. They form the basis of the learning system.
 */

import type {
  KnowledgeNodeId,
  OrganizationId,
  ProjectId,
} from "../../shared/ids/Ids";

/** The type of knowledge node. */
export type KnowledgeNodeType =
  | "concept"
  | "pattern"
  | "entity"
  | "relationship"
  | "insight"
  | "rule"
  | "anomaly";

/** The canonical knowledge node record. */
export interface KnowledgeNode {
  /** Unique identifier for this knowledge node. */
  readonly node_id: KnowledgeNodeId;
  /** Organization this knowledge belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this knowledge belongs to. */
  readonly project_id: ProjectId;
  /** Type of knowledge node. */
  readonly type: KnowledgeNodeType;
  /** Human-readable label for this node. */
  readonly label: string;
  /** Detailed description of the knowledge. */
  readonly description: string;
  /** Structured data associated with this node. */
  readonly properties: Record<string, unknown>;
  /** Confidence in this knowledge node (0.0 to 1.0). */
  readonly confidence: number;
  /** Number of executions that contributed to this knowledge. */
  readonly evidence_count: number;
  /** ISO-8601 timestamp when this node was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this node was last updated. */
  readonly updated_at: string;
  /** Version of the knowledge extraction model used. */
  readonly extraction_model_version: string;
  /** Optional embedding vector for semantic similarity. */
  readonly embedding?: ReadonlyArray<number>;
}

/**
 * Creates a new KnowledgeNode record.
 */
export function createKnowledgeNode(overrides: {
  node_id: KnowledgeNodeId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  type: KnowledgeNodeType;
  label: string;
  description: string;
  properties?: Record<string, unknown>;
  confidence?: number;
  extraction_model_version: string;
  embedding?: ReadonlyArray<number>;
}): KnowledgeNode {
  const now = new Date().toISOString();
  return {
    node_id: overrides.node_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    type: overrides.type,
    label: overrides.label,
    description: overrides.description,
    properties: overrides.properties ?? {},
    confidence: overrides.confidence ?? 0.5,
    evidence_count: 1,
    created_at: now,
    updated_at: now,
    extraction_model_version: overrides.extraction_model_version,
    embedding: overrides.embedding,
  };
}
