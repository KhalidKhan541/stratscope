import type { Context, Next } from "hono";
import { getAuthContext, type AuthContext } from "./auth.js";

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  if (
    c.req.path.startsWith("/v1/seea") ||
    c.req.path.startsWith("/v1/ingest") ||
    c.req.path.startsWith("/v1/access") ||
    c.req.path.startsWith("/v1/auth") ||
    c.req.path.startsWith("/v1/me") ||
    c.req.path.startsWith("/v1/contact")
  ) {
    await next();
    return;
  }

  const auth = getAuthContext(c);

  if (!auth) {
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

  await next();
}

export function getRequiredAuth(c: Context): AuthContext {
  const auth = getAuthContext(c);
  if (!auth) {
    throw new Error("Authentication required");
  }
  return auth;
}
