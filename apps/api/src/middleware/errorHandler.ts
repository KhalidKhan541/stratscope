/**
 * Global error handler middleware for Hono.
 *
 * Catches unhandled errors and domain AppErrors, converting them
 * to consistent JSON error responses with appropriate HTTP status codes.
 */

import type { Context } from "hono";
import type { HTTPResponseError } from "hono/types";
import type { AppError } from "@stratscope/core";

export function errorHandler(error: Error | HTTPResponseError, c: Context): Response | Promise<Response> {
  const appError = toAppError(error);

  const statusCode = getStatusCode(appError.code);

  console.error(
    JSON.stringify({
      level: "error",
      message: "Unhandled error",
      service: "api",
      code: appError.code,
      errorMessage: appError.message,
      details: appError.details,
      path: c.req.path,
      method: c.req.method,
    })
  );

  return c.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details } : {}),
      },
    },
    statusCode as any
  );
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message,
      details: { stack: error.stack },
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  };
}

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as AppError).code === "string"
  );
}

function getStatusCode(code: string): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "PROVIDER_ERROR":
      return 502;
    case "TIMEOUT":
      return 504;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}
