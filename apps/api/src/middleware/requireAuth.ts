import type { Context, Next } from "hono";
import { getAuthContext, type AuthContext } from "./auth.js";

export async function requireAuth(c: Context, next: Next): Promise<void> {
  if (c.req.path.startsWith("/v1/seea")) {
    await next();
    return;
  }

  const auth = getAuthContext(c);
  
  if (!auth) {
    c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      401
    );
    return;
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
