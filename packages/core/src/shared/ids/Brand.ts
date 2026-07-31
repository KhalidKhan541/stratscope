/**
 * Branded type utility for creating nominatively typed IDs.
 *
 * Branded types prevent accidental assignment between different ID types
 * at compile time while remaining structurally identical to strings at runtime.
 *
 * @example
 * ```ts
 * type UserId = Brand<"UserId", string>;
 * type OrgId = Brand<"OrgId", string>;
 *
 * const userId = "usr_123" as UserId;
 * const orgId = "org_456" as OrgId;
 *
 * // userId = orgId; // Compile error!
 * ```
 */
export type Brand<K, T> = T & { readonly __brand: K };
