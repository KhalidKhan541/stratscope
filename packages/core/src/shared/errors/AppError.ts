/**
 * Application error types using discriminated unions.
 *
 * Every error carries a code, human-readable message, and optional
 * domain-specific context. Errors are never thrown; they flow through
 * the Result type.
 */

/** Base error interface shared by all application errors. */
interface AppErrorBase {
  /** Machine-readable error code. */
  readonly code: string;
  /** Human-readable error message. */
  readonly message: string;
  /** Optional structured metadata for debugging. */
  readonly details?: Record<string, unknown>;
}

/** Validation error - input failed schema or business rule validation. */
export interface ValidationError extends AppErrorBase {
  readonly code: "VALIDATION_ERROR";
  readonly fieldErrors?: ReadonlyArray<{
    readonly field: string;
    readonly message: string;
  }>;
}

/** Not found error - requested resource does not exist. */
export interface NotFoundError extends AppErrorBase {
  readonly code: "NOT_FOUND";
  readonly resourceType: string;
  readonly resourceId: string;
}

/** Conflict error - operation conflicts with current state. */
export interface ConflictError extends AppErrorBase {
  readonly code: "CONFLICT";
  readonly conflictReason: string;
}

/** Unauthorized error - authentication or authorization failed. */
export interface UnauthorizedError extends AppErrorBase {
  readonly code: "UNAUTHORIZED";
}

/** Forbidden error - authenticated but insufficient permissions. */
export interface ForbiddenError extends AppErrorBase {
  readonly code: "FORBIDDEN";
  readonly requiredPermission?: string;
}

/** Rate limit error - too many requests. */
export interface RateLimitError extends AppErrorBase {
  readonly code: "RATE_LIMITED";
  readonly retryAfterSeconds: number;
}

/** Internal error - unexpected failure. */
export interface InternalError extends AppErrorBase {
  readonly code: "INTERNAL_ERROR";
}

/** Provider error - upstream AI provider returned an error. */
export interface ProviderError extends AppErrorBase {
  readonly code: "PROVIDER_ERROR";
  readonly provider: string;
  readonly providerStatusCode?: number;
}

/** Timeout error - operation exceeded time limit. */
export interface TimeoutError extends AppErrorBase {
  readonly code: "TIMEOUT";
  readonly operation: string;
  readonly timeoutMs: number;
}

/** Discriminated union of all application errors. */
export type AppError =
  | ValidationError
  | NotFoundError
  | ConflictError
  | UnauthorizedError
  | ForbiddenError
  | RateLimitError
  | InternalError
  | ProviderError
  | TimeoutError;

export function validationError(
  message: string,
  fieldErrors?: ReadonlyArray<{ readonly field: string; readonly message: string }>,
  details?: Record<string, unknown>
): ValidationError {
  return { code: "VALIDATION_ERROR", message, fieldErrors, details };
}

export function notFoundError(
  resourceType: string,
  resourceId: string,
  message?: string
): NotFoundError {
  return {
    code: "NOT_FOUND",
    message: message ?? (resourceType + " with id '" + resourceId + "' not found"),
    resourceType,
    resourceId,
  };
}

export function conflictError(conflictReason: string, message?: string): ConflictError {
  return { code: "CONFLICT", message: message ?? conflictReason, conflictReason };
}

export function unauthorizedError(message?: string): UnauthorizedError {
  return { code: "UNAUTHORIZED", message: message ?? "Authentication required" };
}

export function forbiddenError(requiredPermission?: string, message?: string): ForbiddenError {
  return {
    code: "FORBIDDEN",
    message: message ?? "Insufficient permissions",
    requiredPermission,
  };
}

export function rateLimitError(retryAfterSeconds: number, message?: string): RateLimitError {
  return {
    code: "RATE_LIMITED",
    message: message ?? ("Rate limited. Retry after " + retryAfterSeconds + "s"),
    retryAfterSeconds,
  };
}

export function internalError(message?: string, details?: Record<string, unknown>): InternalError {
  return { code: "INTERNAL_ERROR", message: message ?? "Internal server error", details };
}

export function providerError(
  provider: string,
  message: string,
  providerStatusCode?: number,
  details?: Record<string, unknown>
): ProviderError {
  return { code: "PROVIDER_ERROR", message, provider, providerStatusCode, details };
}

export function timeoutError(operation: string, timeoutMs: number, message?: string): TimeoutError {
  return {
    code: "TIMEOUT",
    message: message ?? ("Operation '" + operation + "' timed out after " + timeoutMs + "ms"),
    operation,
    timeoutMs,
  };
}
