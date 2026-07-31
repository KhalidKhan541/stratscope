import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  unwrap,
  mapOk,
  flatMapOk,
  combineResults,
} from "../../../../../packages/core/src/shared/errors/Result";
import {
  validationError,
  notFoundError,
} from "../../../../../packages/core/src/shared/errors/AppError";

describe("Result", () => {
  describe("ok", () => {
    it("creates an ok result", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(42);
    });

    it("preserves the value type", () => {
      const result = ok("hello");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe("hello");
    });
  });

  describe("err", () => {
    it("creates an err result", () => {
      const error = validationError("Invalid input");
      const result = err(error);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("preserves the error value", () => {
      const error = notFoundError("Execution", "exec-123");
      const result = err(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.resourceType).toBe("Execution");
      }
    });
  });

  describe("unwrap", () => {
    it("returns value for ok", () => {
      expect(unwrap(ok(10))).toBe(10);
    });

    it("throws for err", () => {
      const error = validationError("fail");
      expect(() => unwrap(err(error))).toThrow("[VALIDATION_ERROR] fail");
    });
  });

  describe("mapOk", () => {
    it("transforms ok value", () => {
      const result = mapOk(ok(5), (x) => x * 2);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(10);
    });

    it("passes through err without transforming", () => {
      const error = validationError("fail");
      const result = mapOk(err(error), (x: number) => x * 2);
      expect(result.ok).toBe(false);
    });

    it("chains multiple mapOk calls", () => {
      const result = mapOk(mapOk(ok(5), (x) => x * 2), (x) => x + 1);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(11);
    });
  });

  describe("flatMapOk", () => {
    it("chains ok results", () => {
      const result = flatMapOk(ok(5), (x) => ok(x + 1));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(6);
    });

    it("short-circuits on err", () => {
      const error = validationError("fail");
      const result = flatMapOk(err(error), (x: number) => ok(x + 1));
      expect(result.ok).toBe(false);
    });

    it("chains multiple flatMapOk calls", () => {
      const result = flatMapOk(flatMapOk(ok(5), (x) => ok(x + 1)), (x) =>
        ok(x * 10)
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(60);
    });

    it("short-circuits on inner err", () => {
      const error = validationError("inner fail");
      const result = flatMapOk(ok(5), () => err(error));
      expect(result.ok).toBe(false);
    });
  });

  describe("combineResults", () => {
    it("combines all ok results into array", () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combineResults(results);
      expect(combined.ok).toBe(true);
      if (combined.ok) expect(combined.value).toEqual([1, 2, 3]);
    });

    it("returns first error on failure", () => {
      const error = validationError("bad");
      const results = [ok(1), err(error), ok(3)];
      const combined = combineResults(results);
      expect(combined.ok).toBe(false);
    });

    it("returns ok for empty array", () => {
      const combined = combineResults([]);
      expect(combined.ok).toBe(true);
      if (combined.ok) expect(combined.value).toEqual([]);
    });
  });
});
