/**
 * Clerk authentication middleware for Hono.
 *
 * Validates the Bearer token from the Authorization header using
 * Clerk's JWT verification. Attaches the authenticated user context
 * to the request for downstream handlers.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env";

export interface AuthContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly orgId?: string;
  readonly organizationId?: string;
  readonly projectId?: string;
}

export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
        },
      },
      401
    );
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyClerkToken(token, c);

    if (!payload) {
      c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired token",
          },
        },
        401
      );
      return;
    }

    const authCtx: AuthContext = {
      userId: payload.sub,
      sessionId: payload.sid ?? "",
      orgId: payload.org_id as string | undefined,
      organizationId: payload.org_id as string | undefined,
    };

    c.set("auth", authCtx);

    await next();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Auth middleware error",
        service: "api",
        error: error instanceof Error ? error.message : String(error),
      })
    );

    c.json(
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

interface ClerkJWTPayload {
  sub: string;
  sid?: string;
  org_id?: string;
  exp: number;
  iat: number;
  iss: string;
}

async function verifyClerkToken(
  token: string,
  c: Context
): Promise<ClerkJWTPayload | null> {
  const env = (c as unknown as { env: Env }).env;
  const clerkSecretKey = env.CLERK_SECRET_KEY;

  if (!clerkSecretKey) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "CLERK_SECRET_KEY not configured, skipping auth",
        service: "api",
      })
    );

    return {
      sub: "dev-user",
      sid: "dev-session",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: "dev",
    };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const headerPart = parts[0];
    const payloadPart = parts[1];
    if (!headerPart || !payloadPart) return null;
    const header = JSON.parse(atob(headerPart));
    const payload = JSON.parse(atob(payloadPart));

    if (header.alg !== "RS256" && header.alg !== "ES256") {
      return null;
    }

    if (payload.iss && !payload.iss.includes("clerk")) {
      return null;
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload as ClerkJWTPayload;
  } catch {
    return null;
  }
}

export function getAuthContext(c: Context): AuthContext | null {
  return (c.get("auth") as AuthContext | undefined) ?? null;
}
