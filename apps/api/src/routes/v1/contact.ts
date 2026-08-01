/**
 * Public contact route — "email us for an API key" flow.
 *
 * POST /v1/contact accepts a contact/API-key request, records it in D1,
 * and emails the requester (and the owner) via SMTP. When `request_key` is
 * true an `sk_live_` API key is minted for the public project and emailed
 * to the requester.
 *
 * Public endpoint: no authentication. Protected by a per-email daily rate
 * limit in KV and a honeypot field.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import { EmailError, sendEmail } from "../../lib/email.js";
import { provisionTenant } from "../../lib/provisioning.js";

const contact = new Hono<{ Bindings: Env }>();

const DEFAULT_APP_URL = "https://stratscope-frontend.pages.dev";
const MAX_REQUESTS_PER_DAY = 3;
const CONTACT_KV_TTL_SECONDS = 60 * 60 * 25;

const contactBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  request_key: z.boolean().optional().default(false),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
  agent_name: z.string().trim().max(100).optional(),
  website: z.string().trim().max(100).optional(),
});

type ContactBody = z.infer<typeof contactBodySchema>;

function keyDateKey(email: string): string {
  return `contact:${email}:${new Date().toISOString().slice(0, 10)}`;
}

async function checkRateLimit(
  kv: KVNamespace | undefined,
  email: string
): Promise<boolean> {
  if (!kv) {
    return true;
  }
  const key = keyDateKey(email);
  const existing = (await kv.get<number>(key, "json")) ?? 0;
  const next = existing + 1;
  if (next > MAX_REQUESTS_PER_DAY) {
    return false;
  }
  await kv.put(key, String(next), { expirationTtl: CONTACT_KV_TTL_SECONDS });
  return true;
}

function ownerText(
  body: ContactBody,
  requestId: string,
  keyStatus: string,
  provisioned: Awaited<ReturnType<typeof provisionTenant>> | null
): string {
  const lines = [
    `New contact request (${requestId})`,
    "",
    `Name: ${body.name}`,
    `Email: ${body.email}`,
    `Requested API key: ${body.request_key ? "yes" : "no"}`,
    `Status: ${keyStatus}`,
  ];
  if (provisioned) {
    lines.push(
      `Organization: ${provisioned.organization_id}`,
      `Project: ${provisioned.project_id}`,
      `Agent: ${provisioned.agent_id}`,
      `User: ${provisioned.user_id}`,
      `API key id: ${provisioned.api_key_id}`
    );
  }
  if (body.agent_name) {
    lines.push(`Agent: ${body.agent_name}`);
  }
  if (body.subject) {
    lines.push(`Subject: ${body.subject}`);
  }
  if (body.message) {
    lines.push(`Message: ${body.message}`);
  }
  return lines.join("\n");
}

function usageNote(tenant: {
  key: string;
  projectId: string;
  agentId: string;
  baseUrl: string;
  appUrl: string;
  password: string | null;
}): string {
  const lines = [
    `Your API key is: ${tenant.key}`,
    `Project ID: ${tenant.projectId}`,
    `Agent ID: ${tenant.agentId}`,
    `Base URL: ${tenant.baseUrl}`,
    "",
    "Send it with every request:",
    `  Authorization: Bearer ${tenant.key}`,
  ];
  if (tenant.password) {
    lines.push(
      "",
      "Dashboard sign-in (email + password):",
      `  ${tenant.appUrl}/auth.html`,
      `  Password: ${tenant.password}`,
      "",
      "Store your key and password somewhere safe — for security, they are",
      "shown only once."
    );
  } else {
    lines.push(
      "",
      "You already have a dashboard account — sign in at",
      `  ${tenant.appUrl}/auth.html`,
      "to view your key and agent activity.",
      "",
      "Store your key somewhere safe — for security, it is shown only once."
    );
  }
  return lines.join("\n");
}

async function issueTenant(
  db: D1Database,
  kv: KVNamespace | undefined,
  body: ContactBody
): Promise<Awaited<ReturnType<typeof provisionTenant>>> {
  const existingUser = await db
    .prepare(
      `SELECT id, organization_id FROM users
       WHERE email = ?1 AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(body.email)
    .first<{ id: string; organization_id: string }>();

  return provisionTenant(db, kv, {
    email: body.email,
    name: body.name,
    agentName: body.agent_name,
    existing: existingUser
      ? { userId: existingUser.id, organizationId: existingUser.organization_id }
      : undefined,
  });
}

const contactHandler = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  const env = c.env;

  const body = (await c.req.json()) as ContactBody;

  // Honeypot: a filled-in website field marks this as bot traffic. Fake a
  // success so bots cannot tell they were detected.
  if (body.website && body.website.length > 0) {
    return c.json({ success: true, data: { request_id: null, key_sent: false } }, 201);
  }

  if (!(await checkRateLimit(env.KV, body.email))) {
    return c.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests from this email address. Please try again tomorrow.",
        },
      },
      429
    );
  }

  if (!env.DB) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
      503
    );
  }

  const requestId = crypto.randomUUID();
  const email = body.email;
  let status = "received";
  let keySent = false;
  let keyFailure = false;
  let provisioned: Awaited<ReturnType<typeof provisionTenant>> | null = null;

  if (body.request_key) {
    provisioned = await issueTenant(env.DB, env.KV, body);
    if (!provisioned) {
      return c.json(
        {
          error: {
            code: "PROVISION_FAILED",
            message: "Could not provision an API key right now",
          },
        },
        503
      );
    }

    const baseUrl = env.APP_URL ?? DEFAULT_APP_URL;
    const keyEmail = {
      to: email,
      subject: "Your StratScope API key and dashboard access",
      text: [
        `Hi ${body.name},`,
        "",
        "Welcome to StratScope. Your tenant is ready:",
        "",
        usageNote({
          key: provisioned.api_key,
          projectId: provisioned.project_id,
          agentId: provisioned.agent_id,
          baseUrl,
          appUrl: baseUrl,
          password: provisioned.password,
        }),
      ].join("\n"),
    };

    try {
      await sendEmail(env, keyEmail);
      status = "sent";
      keySent = true;
    } catch (error) {
      status = "key_failed";
      keyFailure = true;
      if (!(error instanceof EmailError)) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Unexpected error sending contact API key email",
            service: "api",
            error: error instanceof Error ? error.message : String(error),
            requestId,
          })
        );
      }
    }
  } else {
    // Confirmation email to the requester — best-effort.
    try {
      await sendEmail(env, {
        to: email,
        subject: "We received your message",
        text: [
          `Hi ${body.name},`,
          "",
          "Thanks for reaching out to StratScope. We received your message and",
          "will get back to you shortly.",
          "",
          `Request ID: ${requestId}`,
        ].join("\n"),
      });
    } catch {
      // Best-effort; the request is still recorded.
    }
  }

  // Owner notification — best-effort, never fails the request.
  if (env.SMTP_USER) {
    try {
      await sendEmail(env, {
        to: env.SMTP_USER,
        subject: `StratScope contact: ${email}`,
        text: ownerText(body, requestId, status, provisioned),
      });
    } catch {
      // Best-effort owner notification.
    }
  }

  await env.DB.prepare(
    `INSERT INTO contact_requests (id, name, email, subject, message, request_key, agent_name, status, organization_id, project_id, agent_id, user_id, api_key_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
  )
    .bind(
      requestId,
      body.name,
      email,
      body.subject ?? null,
      body.message ?? null,
      body.request_key ? 1 : 0,
      body.agent_name ?? null,
      status,
      provisioned?.organization_id ?? null,
      provisioned?.project_id ?? null,
      provisioned?.agent_id ?? null,
      provisioned?.user_id ?? null,
      provisioned?.api_key_id ?? null,
      new Date().toISOString()
    )
    .run();

  const data: { request_id: string; key_sent: boolean } = { request_id: requestId, key_sent: keySent };
  if (keyFailure) {
    return c.json(
      {
        success: true,
        data,
        message: "Request received; your API key will be sent by email shortly.",
      },
      201
    );
  }
  return c.json({ success: true, data }, 201);
};

// Register both "/v1/contact" and "/v1/contact/" — the marketing site posts
// to the former, and the mounted sub-path form resolves to the latter.
contact.post("/", validate({ body: contactBodySchema }), contactHandler);
contact.post("", validate({ body: contactBodySchema }), contactHandler);

export { contact as contactRoutes };
