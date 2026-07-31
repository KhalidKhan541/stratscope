import { describe, it, expect } from "vitest";
import {
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  conflictError,
  internalError,
  rateLimitError,
  providerError,
  timeoutError,
} from "../../../../../packages/core/src/shared/errors/AppError";

describe("AppError", () => {
  describe("validationError", () => {
    it("creates validation error with message", () => {
      const error = validationError("Invalid input");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Invalid input");
      expect(error.fieldErrors).toBeUndefined();
    });

    it("creates validation error with field errors", () => {
      const fieldErrors = [
        { field: "email", message: "Invalid email" },
        { field: "name", message: "Required" },
      ];
      const error = validationError("Invalid input", fieldErrors);
      expect(error.fieldErrors).toEqual(fieldErrors);
    });

    it("creates validation error with details", () => {
      const details = { foo: "bar" };
      const error = validationError("Invalid input", undefined, details);
      expect(error.details).toEqual(details);
    });
  });

  describe("notFoundError", () => {
    it("creates not found error with default message", () => {
      const error = notFoundError("Execution", "exec-123");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe(
        "Execution with id 'exec-123' not found"
      );
      expect(error.resourceType).toBe("Execution");
      expect(error.resourceId).toBe("exec-123");
    });

    it("creates not found error with custom message", () => {
      const error = notFoundError("Execution", "exec-123", "Gone forever");
      expect(error.message).toBe("Gone forever");
    });
  });

  describe("unauthorizedError", () => {
    it("creates unauthorized error with default message", () => {
      const error = unauthorizedError();
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Authentication required");
    });

    it("creates unauthorized error with custom message", () => {
      const error = unauthorizedError("Invalid token");
      expect(error.message).toBe("Invalid token");
    });
  });

  describe("forbiddenError", () => {
    it("creates forbidden error with defaults", () => {
      const error = forbiddenError();
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe("Insufficient permissions");
      expect(error.requiredPermission).toBeUndefined();
    });

    it("creates forbidden error with required permission", () => {
      const error = forbiddenError("admin:write");
      expect(error.requiredPermission).toBe("admin:write");
    });

    it("creates forbidden error with custom message", () => {
      const error = forbiddenError("admin:write", "Nope");
      expect(error.message).toBe("Nope");
    });
  });

  describe("conflictError", () => {
    it("creates conflict error with reason as message", () => {
      const error = conflictError("Already exists");
      expect(error.code).toBe("CONFLICT");
      expect(error.conflictReason).toBe("Already exists");
      expect(error.message).toBe("Already exists");
    });

    it("creates conflict error with custom message", () => {
      const error = conflictError("Already exists", "Duplicate entry");
      expect(error.message).toBe("Duplicate entry");
    });
  });

  describe("internalError", () => {
    it("creates internal error with default message", () => {
      const error = internalError();
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.message).toBe("Internal server error");
    });

    it("creates internal error with custom message", () => {
      const error = internalError("Something went wrong");
      expect(error.message).toBe("Something went wrong");
    });

    it("creates internal error with details", () => {
      const details = { stack: "..." };
      const error = internalError("fail", details);
      expect(error.details).toEqual(details);
    });
  });

  describe("rateLimitError", () => {
    it("creates rate limit error", () => {
      const error = rateLimitError(60);
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.retryAfterSeconds).toBe(60);
      expect(error.message).toBe("Rate limited. Retry after 60s");
    });

    it("creates rate limit error with custom message", () => {
      const error = rateLimitError(30, "Slow down");
      expect(error.message).toBe("Slow down");
    });
  });

  describe("providerError", () => {
    it("creates provider error", () => {
      const error = providerError("groq", "Service unavailable");
      expect(error.code).toBe("PROVIDER_ERROR");
      expect(error.provider).toBe("groq");
      expect(error.message).toBe("Service unavailable");
      expect(error.providerStatusCode).toBeUndefined();
    });

    it("creates provider error with status code", () => {
      const error = providerError("openai", "Rate limited", 429);
      expect(error.providerStatusCode).toBe(429);
    });

    it("creates provider error with details", () => {
      const details = { requestId: "req-1" };
      const error = providerError("groq", "fail", undefined, details);
      expect(error.details).toEqual(details);
    });
  });

  describe("timeoutError", () => {
    it("creates timeout error with default message", () => {
      const error = timeoutError("completion", 5000);
      expect(error.code).toBe("TIMEOUT");
      expect(error.operation).toBe("completion");
      expect(error.timeoutMs).toBe(5000);
      expect(error.message).toBe(
        "Operation 'completion' timed out after 5000ms"
      );
    });

    it("creates timeout error with custom message", () => {
      const error = timeoutError("completion", 5000, "Too slow");
      expect(error.message).toBe("Too slow");
    });
  });
});
