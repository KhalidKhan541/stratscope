/**
 * Structured logger interface for the StratScope platform.
 *
 * All logging goes through this interface. Production implementations
 * use structured JSON output with trace context.
 */

/** Log severity levels. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Context attached to every log entry from this logger instance. */
export interface LogContext {
  /** Service that emitted the log. */
  readonly service: string;
  /** Distributed trace ID for request correlation. */
  readonly traceId?: string;
  /** Execution ID if within an execution context. */
  readonly executionId?: string;
  /** Organization ID if within an organization context. */
  readonly organizationId?: string;
  /** Project ID if within a project context. */
  readonly projectId?: string;
}

/** A single structured log entry. */
export interface LogEntry {
  /** ISO-8601 timestamp. */
  readonly timestamp: string;
  /** Log severity. */
  readonly level: LogLevel;
  /** Human-readable message. */
  readonly message: string;
  /** Structured context fields. */
  readonly context: LogContext;
  /** Additional key-value pairs. */
  readonly data?: Record<string, unknown>;
  /** Error object if logging an error. */
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

/**
 * Structured logger interface.
 *
 * Implementations should emit JSON to stdout/stderr.
 * Never use console.log in production code.
 */
export interface Logger {
  /** Log at debug level. */
  debug(message: string, data?: Record<string, unknown>): void;
  /** Log at info level. */
  info(message: string, data?: Record<string, unknown>): void;
  /** Log at warn level. */
  warn(message: string, data?: Record<string, unknown>): void;
  /** Log at error level. */
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  /** Create a child logger with additional context fields. */
  child(context: Partial<LogContext>): Logger;
}
