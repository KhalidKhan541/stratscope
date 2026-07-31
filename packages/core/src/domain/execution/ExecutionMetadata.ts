/**
 * Metadata attached to an execution.
 *
 * Captures contextual information about the execution environment,
 * request parameters, and any additional user-defined attributes.
 */

/** Execution metadata type. */
export interface ExecutionMetadata {
  /** The user or system that triggered this execution. */
  readonly triggeredBy?: string;
  /** Environment name (e.g., "production", "staging"). */
  readonly environment?: string;
  /** Geographic region where the execution ran. */
  readonly region?: string;
  /** Custom labels for filtering and grouping. */
  readonly labels?: ReadonlyArray<string>;
  /** Freeform tags for categorization. */
  readonly tags?: Record<string, string>;
  /** Request ID from the calling system. */
  readonly requestId?: string;
  /** Session ID if the execution is part of a user session. */
  readonly sessionId?: string;
  /** Model parameters (temperature, max_tokens, etc.). */
  readonly modelParameters?: Record<string, unknown>;
  /** Input parameters passed to the execution. */
  readonly inputParameters?: Record<string, unknown>;
  /** Additional provider-specific metadata. */
  readonly providerMetadata?: Record<string, unknown>;
  /** Version of the application code that triggered this execution. */
  readonly applicationVersion?: string;
}

/** Metadata about the AI provider used for an execution. */
export interface ProviderMetadata {
  /** Provider identifier (e.g., "groq", "openai"). */
  readonly provider: string;
  /** Model identifier (e.g., "llama-3.3-70b-versatile"). */
  readonly model: string;
  /** Provider-assigned request ID. */
  readonly providerRequestId?: string;
  /** Provider-assigned trace ID. */
  readonly providerTraceId?: string;
  /** Whether the response was served from cache. */
  readonly cached?: boolean;
}