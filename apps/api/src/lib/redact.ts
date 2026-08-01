const PII_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp; readonly replacement: string }> = [
  {
    name: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[redacted:email]",
  },
  {
    name: "api_key",
    regex: /\b(sk|pk|rk|ak|vk|ghp|gho|ghu|ghs|ghr|xox[baprs]|gsk)_[A-Za-z0-9_-]{8,}\b/g,
    replacement: "[redacted:api_key]",
  },
  {
    name: "aws_key",
    regex: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: "[redacted:aws_key]",
  },
  {
    name: "bearer_token",
    regex: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}\b/gi,
    replacement: "[redacted:token]",
  },
  {
    name: "phone",
    regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[redacted:phone]",
  },
  {
    name: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[redacted:ssn]",
  },
  {
    name: "credit_card",
    regex: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
    replacement: "[redacted:card]",
  },
  {
    name: "ipv4",
    regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: "[redacted:ip]",
  },
  {
    name: "private_key",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[redacted:private_key]",
  },
];

const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "password",
  "passwd",
  "secret",
  "api_key",
  "apikey",
  "api-key",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "session",
  "session_id",
  "auth",
  "credential",
  "private_key",
  "client_secret",
  "password_hash",
  "cvv",
  "cvc",
  "pin",
  "otp",
  "ssn",
  "social_security",
  "credit_card",
  "card_number",
  "routing_number",
  "iban",
  "swift",
]);

export interface RedactionOptions {
  readonly redactFields?: readonly string[];
  readonly maxPayloadLength?: number;
}

export function redactString(input: string): string {
  let out = input;
  for (const pattern of PII_PATTERNS) {
    out = out.replace(pattern.regex, pattern.replacement);
  }
  return out;
}

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (SENSITIVE_KEYS.has(normalized)) {
    return true;
  }
  const isTokenCredential =
    normalized.includes("token") && !normalized.includes("tokens");
  return (
    isTokenCredential ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.endsWith("_key") ||
    normalized.endsWith("_hash") ||
    normalized.endsWith("_secret")
  );
}

export function redactPayload(
  value: unknown,
  options: RedactionOptions = {},
  depth = 0
): unknown {
  if (depth > 8) {
    return "[redacted:depth]";
  }

  if (typeof value === "string") {
    let out = value;
    if (options.maxPayloadLength && out.length > options.maxPayloadLength) {
      out = out.slice(0, options.maxPayloadLength) + "...[truncated]";
    }
    return redactString(out);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item, options, depth + 1));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      const userRedacted = options.redactFields?.some(
        (field) => field.toLowerCase() === key.toLowerCase()
      );
      if (userRedacted || isSensitiveKey(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = redactPayload(val, options, depth + 1);
      }
    }
    return out;
  }

  return value;
}
