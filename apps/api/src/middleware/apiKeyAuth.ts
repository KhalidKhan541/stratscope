/**
 * API key authentication middleware for Hono.
 *
 * Validates the Bearer token from the Authorization header against the
 * api_keys table using SHA-256 hashing. Attaches the authenticated key
 * record to the request for downstream handlers.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env.js";

export interface ApiKeyAuth {
  readonly id: string;
  readonly name: string;
}

type ApiKeyAuthContext = Context<{
  Bindings: Env;
  Variables: { apiKeyAuth: ApiKeyAuth };
}>;

export async function apiKeyAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        },
      },
      401
    );
  }

  const apiKey = authHeader.slice(7);

  try {
    const env = (c as unknown as { env: Env }).env;
    const db = env.DB;

    if (!db) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Database unavailable",
          },
        },
        500
      );
    }

    const keyHash = await sha256Hex(apiKey);

    const result = await db
      .prepare("SELECT id, name FROM api_keys WHERE key_hash = ?1 AND deleted_at IS NULL")
      .bind(keyHash)
      .first<{ id: string; name: string }>();

    if (!result) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid API key",
          },
        },
        401
      );
    }

    (c as ApiKeyAuthContext).set("apiKeyAuth", {
      id: result.id,
      name: result.name,
    });

    await next();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "API key auth middleware error",
        service: "api",
        error: error instanceof Error ? error.message : String(error),
      })
    );

    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Authentication service unavailable",
        },
      },
      500
    );
  }
}

export function getApiKeyAuth(c: Context): ApiKeyAuth | null {
  return (c as ApiKeyAuthContext).get("apiKeyAuth") ?? null;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
