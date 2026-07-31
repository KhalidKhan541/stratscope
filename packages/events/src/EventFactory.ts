import type {
  ExecutionId,
  OrganizationId,
  ProjectId,
} from '@stratscope/core';
import type {
  DomainEvent,
  EventType,
  EventId,
  ConsentPolicyCreatedEvent,
  ConsentPolicyUpdatedEvent,
  ExecutionAnonymizedEvent,
  ResearchAgentCreatedEvent,
  ResearchAgentStatusChangedEvent,
  DatasetVersionCreatedEvent,
  DatasetVersionValidatedEvent,
  ExperimentCreatedEvent,
  ExperimentStartedEvent,
  ExperimentCompletedEvent,
  BenchmarkRunCreatedEvent,
  BenchmarkRunCompletedEvent,
  SyntheticDataGeneratedEvent,
  ResearchExportCompletedEvent,
} from './EventTypes';
import {
  createEventId,
  CURRENT_SCHEMA_VERSION,
} from './EventTypes';

interface Execution {
  readonly execution_id: ExecutionId;
  readonly organization_id: OrganizationId;
  readonly project_id: ProjectId;
}

interface ExecutionResults {
  readonly [key: string]: unknown;
}

interface Evaluation {
  readonly [key: string]: unknown;
}

interface Reflection {
  readonly [key: string]: unknown;
}

interface Knowledge {
  readonly [key: string]: unknown;
}

interface Learning {
  readonly [key: string]: unknown;
}

interface Optimization {
  readonly [key: string]: unknown;
}

interface Recommendation {
  readonly [key: string]: unknown;
}

export class EventFactory {
  private static buildBase(
    eventType: EventType,
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    metadata: Record<string, unknown> = {}
  ): Omit<DomainEvent, 'payload'> {
    return {
      event_id: createEventId(),
      event_type: eventType,
      execution_id: executionId,
      organization_id: organizationId,
      project_id: projectId,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
      producer: 'stratscope-core',
      metadata: Object.freeze({ ...metadata }),
    };
  }

  static createExecutionCreated(
    execution: Execution,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'execution.created',
      execution.execution_id,
      execution.organization_id,
      execution.project_id,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: execution.execution_id,
        organization_id: execution.organization_id,
        project_id: execution.project_id,
      }),
    });
  }

  static createExecutionAccepted(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'execution.accepted',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
      }),
    });
  }

  static createExecutionStarted(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'execution.started',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        started_at: new Date().toISOString(),
      }),
    });
  }

  static createExecutionCompleted(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    results: ExecutionResults,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'execution.completed',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        completed_at: new Date().toISOString(),
        results: Object.freeze({ ...results }),
      }),
    });
  }

  static createExecutionFailed(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    error: { readonly message: string; readonly code?: string },
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'execution.failed',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        failed_at: new Date().toISOString(),
        error: Object.freeze({ ...error }),
      }),
    });
  }

  static createExecutionCancelled(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    reason?: string,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'execution.cancelled',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        cancelled_at: new Date().toISOString(),
        reason: reason ?? null,
      }),
    });
  }

  static createExecutionArchived(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'execution.archived',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        archived_at: new Date().toISOString(),
      }),
    });
  }

  static createEvaluationGenerated(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    evaluation: Evaluation,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'evaluation.generated',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        evaluation: Object.freeze({ ...evaluation }),
      }),
    });
  }

  static createReflectionGenerated(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    reflection: Reflection,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'reflection.generated',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        reflection: Object.freeze({ ...reflection }),
      }),
    });
  }

  static createKnowledgeExtracted(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    knowledge: Knowledge,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'knowledge.extracted',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        knowledge: Object.freeze({ ...knowledge }),
      }),
    });
  }

  static createLearningGenerated(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    learning: Learning,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'learning.generated',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        learning: Object.freeze({ ...learning }),
      }),
    });
  }

  static createOptimizationGenerated(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    optimization: Optimization,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'optimization.generated',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        optimization: Object.freeze({ ...optimization }),
      }),
    });
  }

  static createRecommendationPublished(
    executionId: ExecutionId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    recommendation: Recommendation,
    metadata: Record<string, unknown> = {}
  ): DomainEvent {
    const base = this.buildBase(
      'recommendation.published',
      executionId,
      organizationId,
      projectId,
      metadata
    );

    return Object.freeze({
      ...base,
      payload: Object.freeze({
        execution_id: executionId,
        recommendation: Object.freeze({ ...recommendation }),
      }),
    });
  }

  static consentPolicyCreated(params: {
    readonly consent_policy_id: string;
    readonly organization_id: string;
    readonly project_id: string;
    readonly agent_id: string;
    readonly scope: string;
  }): ConsentPolicyCreatedEvent {
    return Object.freeze({
      type: "consent_policy.created" as const,
      id: createEventId(),
      consent_policy_id: params.consent_policy_id,
      organization_id: params.organization_id,
      project_id: params.project_id,
      agent_id: params.agent_id,
      scope: params.scope,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static consentPolicyUpdated(params: {
    readonly consent_policy_id: string;
    readonly organization_id: string;
    readonly previous_scope: string;
    readonly new_scope: string;
  }): ConsentPolicyUpdatedEvent {
    return Object.freeze({
      type: "consent_policy.updated" as const,
      id: createEventId(),
      consent_policy_id: params.consent_policy_id,
      organization_id: params.organization_id,
      previous_scope: params.previous_scope,
      new_scope: params.new_scope,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static executionAnonymized(params: {
    readonly execution_id: string;
    readonly organization_id: string;
    readonly anonymization_report_id: string;
    readonly fields_anonymized: readonly string[];
    readonly method: string;
  }): ExecutionAnonymizedEvent {
    return Object.freeze({
      type: "execution.anonymized" as const,
      id: createEventId(),
      execution_id: params.execution_id,
      organization_id: params.organization_id,
      anonymization_report_id: params.anonymization_report_id,
      fields_anonymized: Object.freeze([...params.fields_anonymized]),
      method: params.method,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static researchAgentCreated(params: {
    readonly research_agent_id: string;
    readonly organization_id: string;
    readonly project_id: string;
    readonly agent_type: string;
  }): ResearchAgentCreatedEvent {
    return Object.freeze({
      type: "research_agent.created" as const,
      id: createEventId(),
      research_agent_id: params.research_agent_id,
      organization_id: params.organization_id,
      project_id: params.project_id,
      agent_type: params.agent_type,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static researchAgentStatusChanged(params: {
    readonly research_agent_id: string;
    readonly organization_id: string;
    readonly previous_status: string;
    readonly new_status: string;
  }): ResearchAgentStatusChangedEvent {
    return Object.freeze({
      type: "research_agent.status_changed" as const,
      id: createEventId(),
      research_agent_id: params.research_agent_id,
      organization_id: params.organization_id,
      previous_status: params.previous_status,
      new_status: params.new_status,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static datasetVersionCreated(params: {
    readonly version_id: string;
    readonly dataset_id: string;
    readonly organization_id: string;
    readonly version: string;
    readonly row_count: number;
  }): DatasetVersionCreatedEvent {
    return Object.freeze({
      type: "dataset_version.created" as const,
      id: createEventId(),
      version_id: params.version_id,
      dataset_id: params.dataset_id,
      organization_id: params.organization_id,
      version: params.version,
      row_count: params.row_count,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static datasetVersionValidated(params: {
    readonly version_id: string;
    readonly dataset_id: string;
    readonly organization_id: string;
    readonly consent_verified: boolean;
    readonly validation_passed: boolean;
  }): DatasetVersionValidatedEvent {
    return Object.freeze({
      type: "dataset_version.validated" as const,
      id: createEventId(),
      version_id: params.version_id,
      dataset_id: params.dataset_id,
      organization_id: params.organization_id,
      consent_verified: params.consent_verified,
      validation_passed: params.validation_passed,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static experimentCreated(params: {
    readonly experiment_id: string;
    readonly organization_id: string;
    readonly project_id: string;
    readonly hypothesis: string;
  }): ExperimentCreatedEvent {
    return Object.freeze({
      type: "experiment.created" as const,
      id: createEventId(),
      experiment_id: params.experiment_id,
      organization_id: params.organization_id,
      project_id: params.project_id,
      hypothesis: params.hypothesis,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static experimentStarted(params: {
    readonly experiment_id: string;
    readonly organization_id: string;
  }): ExperimentStartedEvent {
    return Object.freeze({
      type: "experiment.started" as const,
      id: createEventId(),
      experiment_id: params.experiment_id,
      organization_id: params.organization_id,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static experimentCompleted(params: {
    readonly experiment_id: string;
    readonly organization_id: string;
    readonly result_count: number;
  }): ExperimentCompletedEvent {
    return Object.freeze({
      type: "experiment.completed" as const,
      id: createEventId(),
      experiment_id: params.experiment_id,
      organization_id: params.organization_id,
      result_count: params.result_count,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static benchmarkRunCreated(params: {
    readonly run_id: string;
    readonly benchmark_id: string;
    readonly organization_id: string;
  }): BenchmarkRunCreatedEvent {
    return Object.freeze({
      type: "benchmark_run.created" as const,
      id: createEventId(),
      run_id: params.run_id,
      benchmark_id: params.benchmark_id,
      organization_id: params.organization_id,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static benchmarkRunCompleted(params: {
    readonly run_id: string;
    readonly benchmark_id: string;
    readonly organization_id: string;
    readonly metric_count: number;
  }): BenchmarkRunCompletedEvent {
    return Object.freeze({
      type: "benchmark_run.completed" as const,
      id: createEventId(),
      run_id: params.run_id,
      benchmark_id: params.benchmark_id,
      organization_id: params.organization_id,
      metric_count: params.metric_count,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static syntheticDataGenerated(params: {
    readonly dataset_id: string;
    readonly organization_id: string;
    readonly record_count: number;
    readonly source_model: string;
  }): SyntheticDataGeneratedEvent {
    return Object.freeze({
      type: "synthetic_data.generated" as const,
      id: createEventId(),
      dataset_id: params.dataset_id,
      organization_id: params.organization_id,
      record_count: params.record_count,
      source_model: params.source_model,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }

  static researchExportCompleted(params: {
    readonly export_id: string;
    readonly organization_id: string;
    readonly format: string;
    readonly record_count: number;
  }): ResearchExportCompletedEvent {
    return Object.freeze({
      type: "research_export.completed" as const,
      id: createEventId(),
      export_id: params.export_id,
      organization_id: params.organization_id,
      format: params.format,
      record_count: params.record_count,
      timestamp: new Date().toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
    });
  }
}
