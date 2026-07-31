/**
 * Agent - an AI agent that produces executions.
 *
 * Agents represent distinct AI personas or configurations that
 * generate executions within a project.
 */

import type { AgentId, OrganizationId, ProjectId } from "../../shared/ids/Ids";

/** The status of an agent. */
export type AgentStatus = "active" | "inactive" | "deprecated";

/** The canonical agent record. */
export interface Agent {
  /** Unique identifier for this agent. */
  readonly agent_id: AgentId;
  /** Organization this agent belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this agent belongs to. */
  readonly project_id: ProjectId;
  /** Human-readable name. */
  readonly name: string;
  /** Optional description of the agent. */
  readonly description: string;
  /** Agent's system prompt or role definition. */
  readonly system_prompt?: string;
  /** Default model this agent uses. */
  readonly model: string;
  /** Default provider this agent uses. */
  readonly provider: string;
  /** Current status. */
  readonly status: AgentStatus;
  /** Custom configuration for this agent. */
  readonly config: Record<string, unknown>;
  /** ISO-8601 timestamp when this agent was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this agent was last updated. */
  readonly updated_at: string;
}

/**
 * Creates a new Agent record.
 */
export function createAgent(overrides: {
  agent_id: AgentId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  name: string;
  description?: string;
  system_prompt?: string;
  model: string;
  provider: string;
  config?: Record<string, unknown>;
}): Agent {
  const now = new Date().toISOString();
  return {
    agent_id: overrides.agent_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    name: overrides.name,
    description: overrides.description ?? "",
    system_prompt: overrides.system_prompt,
    model: overrides.model,
    provider: overrides.provider,
    status: "active",
    config: overrides.config ?? {},
    created_at: now,
    updated_at: now,
  };
}
