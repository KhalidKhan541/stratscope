/**
 * Console-based structured logger implementation.
 *
 * Outputs JSON to stdout/stderr for log aggregation. Respects the
 * LOG_LEVEL environment variable to filter messages.
 */

import type { Logger, LogLevel, LogContext } from "./Logger";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveLevel(): LogLevel {
  const raw = (typeof process !== "undefined" ? process.env?.["LOG_LEVEL"] : undefined)?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

export class ConsoleLogger implements Logger {
  private readonly minLevel: number;
  private readonly baseContext: LogContext;

  constructor(baseContext: LogContext) {
    this.minLevel = LEVEL_WEIGHT[resolveLevel()];
    this.baseContext = baseContext;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      context: this.baseContext,
      ...data,
    };
    if (error) {
      entry["error"] = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    console.error(JSON.stringify(entry));
  }

  child(context: Partial<LogContext>): ConsoleLogger {
    return new ConsoleLogger({ ...this.baseContext, ...context });
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < this.minLevel) return;
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.baseContext,
      ...data,
    };
    if (level === "error") {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }
}
