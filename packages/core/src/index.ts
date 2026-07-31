/**
 * @stratscope/core
 *
 * Core domain types, branded IDs, error handling, and Result type
 * for the StratScope AI Execution Intelligence Platform.
 */

// Shared
export type {
  OrganizationId, ProjectId, ExecutionId, EventId, ArtifactId,
  EvaluationId, ReflectionId, KnowledgeNodeId, KnowledgeEdgeId,
  LearningRecordId, RecommendationId, AgentId, UserId, ApiKeyId, PipelineId,
  DatasetId, BenchmarkId, CorpusId, DatasetExportId, DatasetVersionId,
} from "./shared/ids/Ids";

export type {
  ResearchAgentId, ConsentPolicyId, AnonymizationReportId,
  ExperimentId, BenchmarkRunId,
} from "./domain/types";
export { createId } from "./shared/ids/Ids";
export type { Brand } from "./shared/ids/Brand";

export type {
  AppError, ValidationError, NotFoundError, ConflictError,
  UnauthorizedError, ForbiddenError, RateLimitError,
  InternalError, ProviderError, TimeoutError,
} from "./shared/errors/AppError";
export {
  validationError, notFoundError, conflictError,
  unauthorizedError, forbiddenError, rateLimitError,
  internalError, providerError, timeoutError,
} from "./shared/errors/AppError";

export type { Result } from "./shared/errors/Result";
export { ok, err, unwrap, mapOk, flatMapOk, combineResults } from "./shared/errors/Result";

export type { Logger, LogLevel, LogContext, LogEntry } from "./shared/logging/Logger";

// Domain: Execution
export type { Execution } from "./domain/execution/Execution";
export { createExecution } from "./domain/execution/Execution";
export type { ExecutionStatus, TerminalExecutionStatus, ActiveExecutionStatus } from "./domain/execution/ExecutionStatus";
export { isTerminalStatus, nextStatus } from "./domain/execution/ExecutionStatus";
export type { ExecutionMetadata, ProviderMetadata } from "./domain/execution/ExecutionMetadata";

// Domain: Artifact
export type { Artifact } from "./domain/artifact/Artifact";
export { createArtifact } from "./domain/artifact/Artifact";
export type { ArtifactType } from "./domain/artifact/ArtifactType";
export { ARTIFACT_STAGE_MAP } from "./domain/artifact/ArtifactType";

// Domain: Event
export type { Event } from "./domain/event/Event";
export { createEvent } from "./domain/event/Event";
export type { EventType, ExecutionEventType, IntelligenceEventType } from "./domain/event/EventType";
export { EVENT_SOURCE_MAP } from "./domain/event/EventType";

// Domain: Evaluation
export type { Evaluation, EvaluationScore, EvaluationDimension } from "./domain/evaluation/Evaluation";
export { createEvaluation } from "./domain/evaluation/Evaluation";

// Domain: Reflection
export type { Reflection, ReflectionInsight, ReflectionType, ReflectionConfidence } from "./domain/reflection/Reflection";
export { createReflection } from "./domain/reflection/Reflection";

// Domain: Knowledge
export type { KnowledgeNode, KnowledgeNodeType } from "./domain/knowledge/KnowledgeNode";
export { createKnowledgeNode } from "./domain/knowledge/KnowledgeNode";
export type { KnowledgeEdge, KnowledgeEdgeType } from "./domain/knowledge/KnowledgeEdge";
export { createKnowledgeEdge } from "./domain/knowledge/KnowledgeEdge";

// Domain: Learning
export type { LearningRecord, LearningType, LearningSeverity } from "./domain/learning/LearningRecord";
export { createLearningRecord } from "./domain/learning/LearningRecord";

// Domain: Recommendation
export type {
  Recommendation, RecommendationImpact, RecommendationCategory,
  RecommendationPriority, RecommendationStatus,
} from "./domain/recommendation/Recommendation";
export { createRecommendation } from "./domain/recommendation/Recommendation";

// Domain: Organization
export type { Organization, OrganizationPlan, OrganizationStatus } from "./domain/organization/Organization";
export { createOrganization } from "./domain/organization/Organization";

// Domain: Project
export type { Project, ProjectStatus } from "./domain/project/Project";
export { createProject } from "./domain/project/Project";

// Domain: Agent
export type { Agent, AgentStatus } from "./domain/agent/Agent";
export { createAgent } from "./domain/agent/Agent";

// Domain: User
export type { User, UserRole, UserStatus, OrganizationMembership } from "./domain/user/User";
export { createUser } from "./domain/user/User";

// Domain: API Key
export type { ApiKey, ApiKeyStatus, ApiKeyScope } from "./domain/apikey/ApiKey";
export { createApiKey } from "./domain/apikey/ApiKey";

// Domain: Dataset
export type { Dataset, DatasetCategory, DatasetStatus, ExportFormat } from "./domain/dataset/Dataset";
export { createDataset } from "./domain/dataset/Dataset";

// Domain: Benchmark
export type { Benchmark, BenchmarkType, BenchmarkStatus, BenchmarkMetric, BenchmarkEntry } from "./domain/benchmark/Benchmark";
export { createBenchmark } from "./domain/benchmark/Benchmark";

// Domain: Corpus
export type { Corpus, CorpusStatus } from "./domain/corpus/Corpus";
export { createCorpus } from "./domain/corpus/Corpus";

// Domain: Consent
export type { ConsentPolicy, ConsentScope } from "./domain/consent/ConsentPolicy";

// Domain: Anonymization
export type { AnonymizationPolicy, AnonymizationMethod, AnonymizationField } from "./domain/anonymization/AnonymizationPolicy";

// Domain: Research
export type { ResearchAgent, ResearchAgentStatus, ResearchAgentType } from "./domain/research/ResearchAgent";
export { createResearchAgent } from "./domain/research/ResearchAgent";

// Domain: Dataset Version
export type { DatasetVersion, DatasetVersionStatus } from "./domain/dataset/DatasetVersion";

// Domain: Experiment
export type { Experiment, ExperimentStatus, ExperimentConfig, ExperimentResult } from "./domain/experiment/Experiment";

// Domain: Benchmark Run
export type { BenchmarkRun, BenchmarkRunStatus, BenchmarkRunMetric } from "./domain/benchmark/BenchmarkRun";
