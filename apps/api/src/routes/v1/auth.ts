/**
 * OAuth authentication routes (Google + GitHub).
 *
 * Replaces Clerk with server-side OAuth. The provider redirects back to
 * this API, which exchanges the code for a token, upserts the user into
 * D1, issues a session token, and redirects to the dashboard with the
 * token in the URL hash fragment so it never hits server logs.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Env } from "../../workers/env.js";
import {
  createSession,
  deleteSession,
  loginWithPassword,
  registerWithPassword,
  upsertOAuthUser,
  type OAuthProfile,
} from "../../lib/authSession.js";
import { validate } from "../../middleware/validate.js";
import { sessionAuth, getSessionUser } from "../../middleware/sessionAuth.js";

const auth = new Hono<{ Bindings: Env }>();

const DEFAULT_REDIRECT_BASE = "https://stratscope-api.khalidkhan.workers.dev";
const DEFAULT_APP_URL = "https://stratscope-frontend.pages.dev";
const STATE_TTL_SECONDS = 600;

function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getRedirectBase(env: Env): string {
  return env.OAUTH_REDIRECT_URL ?? DEFAULT_REDIRECT_BASE;
}

function getAppUrl(env: Env): string {
  return env.APP_URL ?? DEFAULT_APP_URL;
}

async function persistOAuthState(
  kv: KVNamespace | undefined,
  state: string,
  provider: string
): Promise<string> {
  if (!kv) {
    return "";
  }
  try {
    await kv.put(`oauth_state:${state}`, provider, { expirationTtl: STATE_TTL_SECONDS });
    return state;
  } catch {
    return "";
  }
}

async function stateMatches(kv: KVNamespace | undefined, state: string, provider: string): Promise<boolean> {
  if (!kv || !state) {
    return true;
  }
  try {
    return (await kv.get(`oauth_state:${state}`)) === provider;
  } catch {
    return false;
  }
}

async function deleteOAuthState(kv: KVNamespace | undefined, state: string): Promise<void> {
  if (!kv || !state) {
    return;
  }
  try {
    await kv.delete(`oauth_state:${state}`);
  } catch {
    return;
  }
}

function errorRedirect(env: Env, errorCode: string): Response {
  return Response.redirect(
    `${getAppUrl(env)}/auth.html?error=${encodeURIComponent(errorCode)}`,
    302
  );
}

function successRedirect(env: Env, token: string): Response {
  return Response.redirect(`${getAppUrl(env)}/dashboard.html#token=${token}`, 302);
}

auth.get("/google", async (c) => {
  const env = c.env;

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return c.json(
      { error: { code: "OAUTH_NOT_CONFIGURED", message: "Google OAuth is not configured" } },
      503
    );
  }

  const state = await persistOAuthState(env.KV, generateState(), "google");
  const redirectUri = `${getRedirectBase(env)}/v1/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
});

auth.get("/google/callback", async (c) => {
  const env = c.env;
  const code = c.req.query("code");
  const state = c.req.query("state") ?? "";

  if (c.req.query("error") || !code) {
    return errorRedirect(env, "access_denied");
  }

  if (!(await stateMatches(env.KV, state, "google"))) {
    return errorRedirect(env, "invalid_state");
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return c.json(
      { error: { code: "OAUTH_NOT_CONFIGURED", message: "Google OAuth is not configured" } },
      503
    );
  }

  let accessToken: string;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${getRedirectBase(env)}/v1/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return errorRedirect(env, "token_exchange_failed");
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    accessToken = tokenData.access_token ?? "";
  } catch {
    return errorRedirect(env, "token_exchange_failed");
  }

  if (!accessToken) {
    return errorRedirect(env, "token_exchange_failed");
  }

  let userInfo: {
    sub?: string;
    email?: string;
    name?: string | null;
    picture?: string;
  };
  try {
    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    userInfo = await userInfoResponse.json() as typeof userInfo;
  } catch {
    return errorRedirect(env, "token_exchange_failed");
  }

  if (!userInfo.sub || !userInfo.email) {
    return errorRedirect(env, "token_exchange_failed");
  }

  if (!env.DB) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
      503
    );
  }

  const profile: OAuthProfile = {
    provider: "google",
    providerUserId: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name ?? null,
    avatarUrl: userInfo.picture,
  };

  const user = await upsertOAuthUser(env.DB, profile);
  const session = await createSession(env.DB, {
    user,
    ip: c.req.header("CF-Connecting-IP") ?? undefined,
    userAgent: c.req.header("User-Agent") ?? undefined,
  });

  await deleteOAuthState(env.KV, state);

  return successRedirect(env, session.token);
});

auth.get("/github", async (c) => {
  const env = c.env;

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return c.json(
      { error: { code: "OAUTH_NOT_CONFIGURED", message: "GitHub OAuth is not configured" } },
      503
    );
  }

  const state = await persistOAuthState(env.KV, generateState(), "github");
  const redirectUri = `${getRedirectBase(env)}/v1/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`, 302);
});

auth.get("/github/callback", async (c) => {
  const env = c.env;
  const code = c.req.query("code");
  const state = c.req.query("state") ?? "";

  if (c.req.query("error") || !code) {
    return errorRedirect(env, "access_denied");
  }

  if (!(await stateMatches(env.KV, state, "github"))) {
    return errorRedirect(env, "invalid_state");
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return c.json(
      { error: { code: "OAUTH_NOT_CONFIGURED", message: "GitHub OAuth is not configured" } },
      503
    );
  }

  let accessToken: string;
  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${getRedirectBase(env)}/v1/auth/github/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      return errorRedirect(env, "token_exchange_failed");
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    accessToken = tokenData.access_token ?? "";
  } catch {
    return errorRedirect(env, "token_exchange_failed");
  }

  if (!accessToken) {
    return errorRedirect(env, "token_exchange_failed");
  }

  let userInfo: {
    id?: number;
    login?: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string;
  };
  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "StratScope",
      },
    });

    if (!userResponse.ok) {
      return errorRedirect(env, "token_exchange_failed");
    }

    userInfo = await userResponse.json() as typeof userInfo;
  } catch {
    return errorRedirect(env, "token_exchange_failed");
  }

  let email = userInfo.email ?? null;
  if (!email) {
    try {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "StratScope",
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as Array<{ email?: string; primary?: boolean }>;
        email =
          emails.find((entry) => entry.primary === true && entry.email)?.email ??
          emails[0]?.email ??
          null;
      }
    } catch {
      email = null;
    }
  }

  if (!userInfo.id || !userInfo.login) {
    return errorRedirect(env, "token_exchange_failed");
  }

  if (!email) {
    email = `${userInfo.login}@users.noreply.github.com`;
  }

  if (!env.DB) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
      503
    );
  }

  const profile: OAuthProfile = {
    provider: "github",
    providerUserId: String(userInfo.id),
    email,
    name: userInfo.name ?? null,
    avatarUrl: userInfo.avatar_url,
  };

  const user = await upsertOAuthUser(env.DB, profile);
  const session = await createSession(env.DB, {
    user,
    ip: c.req.header("CF-Connecting-IP") ?? undefined,
    userAgent: c.req.header("User-Agent") ?? undefined,
  });

  await deleteOAuthState(env.KV, state);

  return successRedirect(env, session.token);
});

auth.get("/me", sessionAuth, (c) => {
  const user = getSessionUser(c);

  if (!user) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      401
    );
  }

  return c.json({
    data: {
      userId: user.userId,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      role: user.role,
      provider: user.provider,
    },
  });
});

auth.post("/logout", sessionAuth, async (c) => {
  const env = c.env;
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (env.DB && token) {
    await deleteSession(env.DB, token);
  }

  return c.json({ data: { success: true } });
});

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

function sessionBody(session: {
  token: string;
  expiresAt: string;
  user: {
    userId: string;
    email: string;
    name: string | null;
    organizationId: string;
    role: string;
    provider: string;
  };
}) {
  return {
    data: {
      token: session.token,
      expires_at: session.expiresAt,
      user: {
        userId: session.user.userId,
        email: session.user.email,
        name: session.user.name,
        organizationId: session.user.organizationId,
        role: session.user.role,
        provider: session.user.provider,
      },
    },
  };
}

auth.post("/register", validate({ body: registerSchema }), async (c) => {
  const env = c.env;

  if (!env.DB) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
      503
    );
  }

  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { fieldErrors: parsed.error.issues },
        },
      },
      400
    );
  }

  const result = await registerWithPassword(env.DB, parsed.data);

  if (!result.ok) {
    return c.json(
      { error: { code: "EMAIL_TAKEN", message: "An account with this email already exists" } },
      409
    );
  }

  const session = await createSession(env.DB, {
    user: result.user,
    ip: c.req.header("CF-Connecting-IP") ?? undefined,
    userAgent: c.req.header("User-Agent") ?? undefined,
  });

  return c.json(sessionBody(session));
});

auth.post("/login", validate({ body: loginSchema }), async (c) => {
  const env = c.env;

  if (!env.DB) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
      503
    );
  }

  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { fieldErrors: parsed.error.issues },
        },
      },
      400
    );
  }

  const user = await loginWithPassword(env.DB, parsed.data.email, parsed.data.password);

  if (!user) {
    return c.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
      401
    );
  }

  const session = await createSession(env.DB, {
    user,
    ip: c.req.header("CF-Connecting-IP") ?? undefined,
    userAgent: c.req.header("User-Agent") ?? undefined,
  });

  return c.json(sessionBody(session));
});

export { auth as authRoutes };
