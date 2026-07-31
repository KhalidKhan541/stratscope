import type { OrganizationId, ProjectId } from "../../shared/ids/Ids";
import type { ResearchAgentId } from "../types";

export type ResearchAgentStatus = "active" | "inactive" | "deprecated";

export type ResearchAgentType = "evaluator" | "critic" | "generator" | "analyzer";

export interface ResearchAgent {
  readonly id: ResearchAgentId;
  readonly organization_id: OrganizationId;
  readonly project_id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly agent_type: ResearchAgentType;
  readonly status: ResearchAgentStatus;
  readonly config: Record<string, unknown>;
  readonly capabilities: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export function createResearchAgent(overrides: {
  id: ResearchAgentId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  name: string;
  description?: string;
  agent_type: ResearchAgentType;
  config?: Record<string, unknown>;
  capabilities?: readonly string[];
}): ResearchAgent {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    name: overrides.name,
    description: overrides.description ?? "",
    agent_type: overrides.agent_type,
    status: "active",
    config: overrides.config ?? {},
    capabilities: overrides.capabilities ?? [],
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}
