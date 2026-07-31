/**
 * Result type for error handling without exceptions.
 *
 * All domain operations return Result<T, AppError> instead of throwing.
 * This makes error paths explicit and composable.
 */

import type { AppError } from "./AppError";

/** Successful result containing a value. */
interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** Failure result containing an error. */
interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Discriminated union representing either success or failure.
 * Never use throw; always return Result.
 */
export type Result<T, E = AppError> = Ok<T> | Err<E>;

/**
 * Creates a successful Result.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates a failed Result.
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Unwraps a Result, returning the value or throwing.
 * Use only at the boundary where exceptions are acceptable.
 */
export function unwrap<T>(result: Result<T, AppError>): T {
  if (result.ok) return result.value;
  const e = result.error;
  throw new Error("[" + e.code + "] " + e.message);
}

/**
 * Maps the success value of a Result.
 */
export function mapOk<T, U>(
  result: Result<T, AppError>,
  fn: (value: T) => U
): Result<U, AppError> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

/**
 * Chains a Result-returning function over a success value.
 */
export function flatMapOk<T, U>(
  result: Result<T, AppError>,
  fn: (value: T) => Result<U, AppError>
): Result<U, AppError> {
  if (result.ok) return fn(result.value);
  return result;
}

/**
 * Combines multiple Results into a single Result containing an array.
 * Returns the first error encountered if any fail.
 */
export function combineResults<T>(
  results: ReadonlyArray<Result<T, AppError>>
): Result<ReadonlyArray<T>, AppError> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}
