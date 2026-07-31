import type {
  ExecutionId,
  OrganizationId,
  ProjectId,
} from '@stratscope/core';

export type EventId = string & { readonly __brand: 'EventId' };

export const createEventId = (): EventId => {
  const id = crypto.randomUUID();
  return id as EventId;
};

export type EventType =
  | 'execution.created'
  | 'execution.accepted'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.cancelled'
  | 'execution.archived'
  | 'evaluation.generated'
  | 'reflection.generated'
  | 'knowledge.extracted'
  | 'learning.generated'
  | 'optimization.generated'
  | 'recommendation.published'
  | 'dataset.created'
  | 'dataset.validated'
  | 'dataset.exported'
  | 'benchmark.created'
  | 'benchmark.completed'
  | 'corpus.published'
  | 'consent_policy.created'
  | 'consent_policy.updated'
  | 'execution.anonymized'
  | 'research_agent.created'
  | 'research_agent.status_changed'
  | 'dataset_version.created'
  | 'dataset_version.validated'
  | 'experiment.created'
  | 'experiment.started'
  | 'experiment.completed'
  | 'benchmark_run.created'
  | 'benchmark_run.completed'
  | 'synthetic_data.generated'
  | 'research_export.completed';

export interface DomainEvent {
  readonly event_id: EventId;
  readonly event_type: EventType;
  readonly execution_id: ExecutionId;
  readonly organization_id: OrganizationId;
  readonly project_id: ProjectId;
  readonly timestamp: string;
  readonly schema_version: string;
  readonly producer: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}

export interface PaginationOptions {
  readonly cursor?: string;
  readonly limit: number;
  readonly direction?: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
  readonly total_count: number;
}

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export interface ConsentPolicyCreatedEvent {
  readonly type: "consent_policy.created";
  readonly id: string;
  readonly consent_policy_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id: string;
  readonly scope: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ConsentPolicyUpdatedEvent {
  readonly type: "consent_policy.updated";
  readonly id: string;
  readonly consent_policy_id: string;
  readonly organization_id: string;
  readonly previous_scope: string;
  readonly new_scope: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ExecutionAnonymizedEvent {
  readonly type: "execution.anonymized";
  readonly id: string;
  readonly execution_id: string;
  readonly organization_id: string;
  readonly anonymization_report_id: string;
  readonly fields_anonymized: readonly string[];
  readonly method: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ResearchAgentCreatedEvent {
  readonly type: "research_agent.created";
  readonly id: string;
  readonly research_agent_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_type: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ResearchAgentStatusChangedEvent {
  readonly type: "research_agent.status_changed";
  readonly id: string;
  readonly research_agent_id: string;
  readonly organization_id: string;
  readonly previous_status: string;
  readonly new_status: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface DatasetVersionCreatedEvent {
  readonly type: "dataset_version.created";
  readonly id: string;
  readonly version_id: string;
  readonly dataset_id: string;
  readonly organization_id: string;
  readonly version: string;
  readonly row_count: number;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface DatasetVersionValidatedEvent {
  readonly type: "dataset_version.validated";
  readonly id: string;
  readonly version_id: string;
  readonly dataset_id: string;
  readonly organization_id: string;
  readonly consent_verified: boolean;
  readonly validation_passed: boolean;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ExperimentCreatedEvent {
  readonly type: "experiment.created";
  readonly id: string;
  readonly experiment_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly hypothesis: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ExperimentStartedEvent {
  readonly type: "experiment.started";
  readonly id: string;
  readonly experiment_id: string;
  readonly organization_id: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ExperimentCompletedEvent {
  readonly type: "experiment.completed";
  readonly id: string;
  readonly experiment_id: string;
  readonly organization_id: string;
  readonly result_count: number;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface BenchmarkRunCreatedEvent {
  readonly type: "benchmark_run.created";
  readonly id: string;
  readonly run_id: string;
  readonly benchmark_id: string;
  readonly organization_id: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface BenchmarkRunCompletedEvent {
  readonly type: "benchmark_run.completed";
  readonly id: string;
  readonly run_id: string;
  readonly benchmark_id: string;
  readonly organization_id: string;
  readonly metric_count: number;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface SyntheticDataGeneratedEvent {
  readonly type: "synthetic_data.generated";
  readonly id: string;
  readonly dataset_id: string;
  readonly organization_id: string;
  readonly record_count: number;
  readonly source_model: string;
  readonly timestamp: string;
  readonly schema_version: string;
}

export interface ResearchExportCompletedEvent {
  readonly type: "research_export.completed";
  readonly id: string;
  readonly export_id: string;
  readonly organization_id: string;
  readonly format: string;
  readonly record_count: number;
  readonly timestamp: string;
  readonly schema_version: string;
}

export type ErpEvent =
  | ConsentPolicyCreatedEvent
  | ConsentPolicyUpdatedEvent
  | ExecutionAnonymizedEvent
  | ResearchAgentCreatedEvent
  | ResearchAgentStatusChangedEvent
  | DatasetVersionCreatedEvent
  | DatasetVersionValidatedEvent
  | ExperimentCreatedEvent
  | ExperimentStartedEvent
  | ExperimentCompletedEvent
  | BenchmarkRunCreatedEvent
  | BenchmarkRunCompletedEvent
  | SyntheticDataGeneratedEvent
  | ResearchExportCompletedEvent;
