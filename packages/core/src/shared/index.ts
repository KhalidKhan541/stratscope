/**
 * Barrel exports for all shared utilities.
 */

export type { Brand } from "./ids/Brand";
export {
  type OrganizationId, type ProjectId, type ExecutionId, type EventId,
  type ArtifactId, type EvaluationId, type ReflectionId,
  type KnowledgeNodeId, type KnowledgeEdgeId, type LearningRecordId,
  type RecommendationId, type AgentId, type UserId, type ApiKeyId, type PipelineId,
  createId,
} from "./ids/Ids";

export type {
  AppError, ValidationError, NotFoundError, ConflictError,
  UnauthorizedError, ForbiddenError, RateLimitError,
  InternalError, ProviderError, TimeoutError,
} from "./errors/AppError";
export {
  validationError, notFoundError, conflictError,
  unauthorizedError, forbiddenError, rateLimitError,
  internalError, providerError, timeoutError,
} from "./errors/AppError";

export type { Result } from "./errors/Result";
export { ok, err, unwrap, mapOk, flatMapOk, combineResults } from "./errors/Result";

export type { Logger, LogLevel, LogContext, LogEntry } from "./logging/Logger";
