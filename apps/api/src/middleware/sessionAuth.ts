/**
 * Session authentication middleware.
 *
 * Validates the Bearer session token from the Authorization header
 * against the sessions table. Attaches the session user context to the
 * request for downstream handlers. Replaces Clerk-based auth for the
 * dashboard flows.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env.js";
import { verifySessionToken, type SessionUser } from "../lib/authSession.js";

type SessionAuthContext = Context<{
  Bindings: Env;
  Variables: { sessionUser: SessionUser };
}>;

export async function sessionAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      401
    );
  }

  const token = authHeader.slice(7);
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
    const user = await verifySessionToken(env.DB, token);

    if (!user) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired session",
          },
        },
        401
      );
    }

    (c as SessionAuthContext).set("sessionUser", user);
    await next();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Session auth middleware error",
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

export function getSessionUser(c: Context): SessionUser | null {
  return (c as SessionAuthContext).get("sessionUser") ?? null;
}
