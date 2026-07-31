import type { D1Database, KVNamespace, R2Bucket, Queue } from "@cloudflare/workers-types";

export interface Env {
  DB?: D1Database;
  KV?: KVNamespace;
  R2?: R2Bucket;
  QUEUE?: Queue;

  ENVIRONMENT: string;

  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  GROQ_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
}
