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
  BENCHMARK_KEY?: string;

  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  OAUTH_REDIRECT_URL?: string;
  APP_URL?: string;

  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_APP_PASSWORD?: string;
  SMTP_FROM?: string;
}
