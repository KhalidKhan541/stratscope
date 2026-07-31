import type { ConsentPolicyId } from "../types";

export type ConsentScope = "private" | "anonymized_benchmarks" | "research_contributor";

export interface ConsentPolicy {
  readonly consent_policy_id: ConsentPolicyId;
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id: string;
  readonly scope: ConsentScope;
  readonly allowed_use_cases: readonly string[];
  readonly retention_days: number;
  readonly requires_anonymization: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}
