/**
 * Access credential authentication middleware.
 *
 * Validates the Bearer credential from the Authorization header against
 * the access_grants table. Grants are read-only by design: a validated
 * grant may only be used against read endpoints mounted with this
 * middleware. Attaches the grant to the request for downstream handlers.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env.js";
import {
  type AccessGrant,
  verifyAccessCredential,
} from "../lib/accessGrants.js";

export type { AccessGrant };

type AccessAuthContext = Context<{
  Bindings: Env;
  Variables: { accessGrant: AccessGrant };
}>;

export async function accessKeyAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid access credential",
        },
      },
      401
    );
  }

  const credential = authHeader.slice(7);
  const env = (c as unknown as { env: Env }).env;

  if (!env.DB) {
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

  try {
    const grant = await verifyAccessCredential(env.DB, credential);

    if (!grant) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or revoked access credential",
          },
        },
        401
      );
    }

    (c as AccessAuthContext).set("accessGrant", grant);
    await next();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Access credential auth middleware error",
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

export function getAccessGrant(c: Context): AccessGrant | null {
  return (c as AccessAuthContext).get("accessGrant") ?? null;
}
