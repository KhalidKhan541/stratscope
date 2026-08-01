/**
 * Minimal SMTP email sender for the StratScope API.
 *
 * Sends email over TLS (SMTPS, port 465) using the Workers Sockets API
 * (`connect` from `cloudflare:sockets`). The socket layer is injectable
 * so the SMTP state machine can be unit-tested without a network.
 *
 * SMTP configuration comes from worker secrets / vars:
 *   SMTP_HOST          (default smtp.gmail.com)
 *   SMTP_PORT          (default 465)
 *   SMTP_USER          (sender mailbox / login)
 *   SMTP_APP_PASSWORD  (Gmail app password)
 *   SMTP_FROM          (defaults to SMTP_USER)
 */

import type { Env } from "../workers/env.js";

export type SmtpErrorCode =
  | "SMTP_AUTH_FAILED"
  | "SMTP_REJECTED"
  | "SMTP_TIMEOUT"
  | "SMTP_NETWORK"
  | "SMTP_CONFIG_MISSING";

export class EmailError extends Error {
  readonly code: SmtpErrorCode;

  constructor(code: SmtpErrorCode, message: string) {
    super(message);
    this.name = "EmailError";
    this.code = code;
  }
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Structural socket interface — satisfied by the Workers Socket returned
 * from `connect()` and by the in-memory fake used in tests.
 */
export interface SmtpSocketLike {
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
  readonly opened?: Promise<unknown>;
  close(): Promise<void>;
}

export type SocketFactory = (host: string, port: number) => SmtpSocketLike;

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly appPassword: string;
  readonly from: string;
}

const DEFAULT_HOST = "smtp.gmail.com";
const DEFAULT_PORT = 465;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Lazily loads the Workers Sockets API. Kept behind a dynamic import so the
 * module stays importable in non-Workers test environments.
 */
async function loadSocketFactory(): Promise<SocketFactory> {
  const { connect } = await import(/* @vite-ignore */ "cloudflare:sockets");
  return (host, port) =>
    connect(
      { hostname: host, port },
      { secureTransport: "on", allowHalfOpen: true }
    );
}

/**
 * Sends a plain-text email via SMTP over TLS.
 *
 * @throws EmailError on missing config, auth failure, rejection, timeout or
 *   network failure. Never throws non-EmailError exceptions.
 */
export async function sendEmail(
  env: Env,
  msg: EmailMessage,
  socketFactory?: SocketFactory
): Promise<void> {
  const user = env.SMTP_USER;
  const appPassword = env.SMTP_APP_PASSWORD;
  if (!user || !appPassword) {
    throw new EmailError(
      "SMTP_CONFIG_MISSING",
      "SMTP_USER and SMTP_APP_PASSWORD must be configured"
    );
  }

  const config: SmtpConfig = {
    host: env.SMTP_HOST ?? DEFAULT_HOST,
    port: env.SMTP_PORT ?? DEFAULT_PORT,
    user,
    appPassword,
    from: env.SMTP_FROM ?? user,
  };

  const factory = socketFactory ?? (await loadSocketFactory());
  const socket = factory(config.host, config.port);

  try {
    if (socket.opened) {
      await socket.opened;
    }
    await runSmtp(socket, config, msg);
  } catch (error) {
    if (error instanceof EmailError) {
      throw error;
    }
    throw new EmailError(
      "SMTP_NETWORK",
      `SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    try {
      await socket.close();
    } catch {
      // Best-effort close; the SMTP state machine already reported failures.
    }
  }
}

/**
 * SMTP state machine. Speaks the minimal subset required to send one
 * plain-text message:
 *
 *   read 220 greeting
 *   EHLO stratscope-api            -> 250
 *   AUTH PLAIN base64(\0u\0p)      -> 235 (535 => SMTP_AUTH_FAILED)
 *   MAIL FROM:<from>               -> 250
 *   RCPT TO:<to>                   -> 250
 *   DATA                           -> 354
 *   headers + blank line + body +  -> 250 (5xx => SMTP_REJECTED)
 *   QUIT
 *
 * Throws EmailError only. Unknown errors are mapped to SMTP_NETWORK.
 */
export async function runSmtp(
  socket: SmtpSocketLike,
  config: SmtpConfig,
  msg: EmailMessage,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> {
  try {
    const reader = new SmtpReader(socket.readable, timeoutMs);
    const writer = socket.writable.getWriter();

    try {
      await expectCode(reader, [220], "greeting", timeoutMs);

      await sendLine(writer, "EHLO stratscope-api");
      await expectCode(reader, [250], "ehlo", timeoutMs);

      const credentials = btoa(`\u0000${config.user}\u0000${config.appPassword}`);
      await sendLine(writer, `AUTH PLAIN ${credentials}`);
      await expectCode(reader, [235], "auth", timeoutMs, {
        onUnexpected: (code) => {
          if (code === 535) {
            throw new EmailError(
              "SMTP_AUTH_FAILED",
              "SMTP authentication failed (bad username or app password)"
            );
          }
        },
      });

      await sendLine(writer, `MAIL FROM:<${config.from}>`);
      await expectCode(reader, [250], "mail-from", timeoutMs);

      await sendLine(writer, `RCPT TO:<${msg.to}>`);
      await expectCode(reader, [250, 251], "rcpt-to", timeoutMs);

      await sendLine(writer, "DATA");
      await expectCode(reader, [354], "data", timeoutMs);

      const headers = [
        `From: ${sanitizeHeader(config.from)}`,
        `To: ${sanitizeHeader(msg.to)}`,
        `Subject: ${sanitizeHeader(msg.subject)}`,
        "Content-Type: text/plain; charset=utf-8",
      ].join("\n");
      const body = dotStuff(`${headers}\n\n${msg.text}`).replace(/\r?\n/g, "\r\n");
      await writeRaw(writer, `${body}\r\n.\r\n`);
      await expectCode(reader, [250], "message", timeoutMs, {
        onUnexpected: (code) => {
          if (code >= 500) {
            throw new EmailError(
              "SMTP_REJECTED",
              `SMTP server rejected the message (${code})`
            );
          }
        },
      });

      await sendLine(writer, "QUIT");
    } finally {
      try {
        writer.releaseLock();
      } catch {
        // Lock may already be released if a write failed.
      }
    }
  } catch (error) {
    if (error instanceof EmailError) {
      throw error;
    }
    throw new EmailError(
      "SMTP_NETWORK",
      `SMTP network or protocol error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function dotStuff(text: string): string {
  return text.replace(/^\./gm, "..");
}

async function sendLine(writer: WritableStreamDefaultWriter<Uint8Array>, line: string): Promise<void> {
  await writeRaw(writer, `${line}\r\n`);
}

async function writeRaw(writer: WritableStreamDefaultWriter<Uint8Array>, data: string): Promise<void> {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(data));
}

/**
 * Reads one SMTP reply. Multi-line replies ("250-...") are consumed until
 * the final line ("250 ..."), then the code is checked against `expected`.
 */
async function expectCode(
  reader: SmtpReader,
  expected: number[],
  step: string,
  timeoutMs: number,
  options?: { onUnexpected?: (code: number) => void }
): Promise<string> {
  let line = await reader.readLine(timeoutMs);
  const code = parseReplyCode(line);
  while (line.length > 3 && line[3] === "-") {
    line = await reader.readLine(timeoutMs);
  }

  if (!expected.includes(code)) {
    if (options?.onUnexpected) {
      options.onUnexpected(code);
    }
    if (code >= 500) {
      throw new EmailError(
        "SMTP_REJECTED",
        `SMTP server rejected ${step} request (${code}: ${line})`
      );
    }
    throw new EmailError(
      "SMTP_NETWORK",
      `Unexpected SMTP reply during ${step} (${code}: ${line})`
    );
  }

  return line;
}

function parseReplyCode(line: string): number {
  const match = line.match(/^(\d{3})/);
  return match ? Number(match[1]) : -1;
}

/**
 * Line-buffered reader over a socket's readable stream with a per-read
 * timeout. Handles both CRLF and bare LF line endings.
 */
class SmtpReader {
  private readonly decoder = new TextDecoder();
  private buffer = "";

  constructor(
    private readonly stream: ReadableStream,
    private readonly timeoutMs: number
  ) {}

  async readLine(timeoutMs: number = this.timeoutMs): Promise<string> {
    for (;;) {
      const lfIndex = this.buffer.indexOf("\n");
      if (lfIndex >= 0) {
        const line = this.buffer.slice(0, lfIndex).replace(/\r$/, "");
        this.buffer = this.buffer.slice(lfIndex + 1);
        return line;
      }
      const chunk = await this.readChunk(timeoutMs);
      if (chunk === null) {
        throw new EmailError("SMTP_NETWORK", "SMTP connection closed by server");
      }
      this.buffer += this.decoder.decode(chunk, { stream: true });
    }
  }

  private async readChunk(timeoutMs: number): Promise<ArrayBuffer | Uint8Array | null> {
    const reader = this.stream.getReader();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new EmailError("SMTP_TIMEOUT", "SMTP read timed out")),
        timeoutMs
      );
    });

    try {
      const result = (await Promise.race([reader.read(), timeout])) as
        | ReadableStreamReadResult<ArrayBuffer | Uint8Array>
        | never;
      if (result.done) {
        return null;
      }
      return result.value;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      try {
        reader.releaseLock();
      } catch {
        // A pending read (e.g. timed out) keeps the lock; nothing to release.
      }
    }
  }
}
