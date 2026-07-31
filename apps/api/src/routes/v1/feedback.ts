/**
 * Feedback routes — submission.
 *
 * Handles feedback submission for executions.
 * All routes are versioned under /v1/feedback.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const feedback = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const FEEDBACK_SENTIMENT_ENUM = z.enum([
  "positive",
  "negative",
  "neutral",
  "mixed",
]);

const submitFeedbackBodySchema = z.object({
  execution_id: z.string().min(1, "execution_id is required"),
  sentiment: FEEDBACK_SENTIMENT_ENUM,
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type SubmitFeedbackBody = z.infer<typeof submitFeedbackBodySchema>;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface FeedbackResponse {
  readonly id: string;
  readonly execution_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly sentiment: string;
  readonly rating: number | null;
  readonly comment: string | null;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /v1/feedback — Submit feedback
 */
feedback.post(
  "/",
  validate({ body: submitFeedbackBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    // Verify execution exists and belongs to the organization
    const execution = await c.env.DB.prepare(
      `SELECT id, project_id FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(body.execution_id, auth.organizationId)
      .first<{ id: string; project_id: string }>();

    if (!execution) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Execution with id '${body.execution_id}' not found`,
          },
        },
        404
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO feedback (
        id, execution_id, organization_id, project_id,
        sentiment, rating, comment, tags, metadata, created_at
      ) VALUES (
        ?1, ?2, ?3, ?4,
        ?5, ?6, ?7, ?8, ?9, ?10
      )`
    )
      .bind(
        id,
        body.execution_id,
        auth.organizationId,
        execution.project_id,
        body.sentiment,
        body.rating ?? null,
        body.comment ?? null,
        JSON.stringify(body.tags ?? []),
        JSON.stringify(body.metadata ?? {}),
        now
      )
      .run();

    const response: FeedbackResponse = {
      id,
      execution_id: body.execution_id,
      organization_id: auth.organizationId,
      project_id: execution.project_id,
      sentiment: body.sentiment,
      rating: body.rating ?? null,
      comment: body.comment ?? null,
      tags: body.tags ?? [],
      metadata: body.metadata ?? {},
      created_at: now,
    };

    return c.json(response, 201);
  }
);

export { feedback as feedbackRoutes };
