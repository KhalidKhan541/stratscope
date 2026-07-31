import { Hono } from "hono";
import { getAuthContext } from "../../middleware/auth.js";

const auth = new Hono();

auth.get("/me", async (c) => {
  const authCtx = getAuthContext(c);
  
  if (!authCtx) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      401
    );
  }
  
  return c.json({
    user_id: authCtx.userId,
    session_id: authCtx.sessionId,
    org_id: authCtx.orgId,
    organization_id: authCtx.organizationId,
    project_id: authCtx.projectId,
  });
});

auth.get("/session", async (c) => {
  const authCtx = getAuthContext(c);
  
  if (!authCtx) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      401
    );
  }
  
  return c.json({
    authenticated: true,
    user_id: authCtx.userId,
    session_id: authCtx.sessionId,
  });
});

export { auth as authRoutes };
