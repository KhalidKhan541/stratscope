import { describe, it, expect } from "vitest";
import { EmailError, runSmtp, sendEmail, type SmtpSocketLike } from "./email.js";
import type { Env } from "../workers/env.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class FakeSocket implements SmtpSocketLike {
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
  private readonly chunks: Uint8Array[] = [];
  readonly closeCalls: number[] = [];

  constructor(replyLines: string[], readableOverride?: ReadableStream) {
    this.readable =
      readableOverride ??
      new ReadableStream({
        start(controller) {
          for (const line of replyLines) {
            controller.enqueue(encoder.encode(`${line}\r\n`));
          }
          controller.close();
        },
      });
    this.writable = new WritableStream({
      write: (chunk) => {
        this.chunks.push(chunk as Uint8Array);
      },
    });
  }

  transcript(): string {
    return this.chunks.map((c) => decoder.decode(c)).join("");
  }

  async close(): Promise<void> {
    this.closeCalls.push(1);
  }
}

function happySocket(): FakeSocket {
  return new FakeSocket([
    "220 smtp.gmail.com ESMTP ready",
    "250-smtp.gmail.com at your service",
    "250-SIZE 35882577",
    "250 ENHANCEDSTATUSCODES",
    "235 2.7.0 Accepted",
    "250 2.1.0 Ok",
    "250 2.1.5 Ok",
    "354 End data with <CR><LF>.<CR><LF>",
    "250 2.0.0 OK: queued as abc123",
  ]);
}

const CONFIG = {
  host: "smtp.gmail.com",
  port: 465,
  user: "owner@stratscope.app",
  appPassword: "app-pass-123",
  from: "no-reply@stratscope.app",
};

const MESSAGE = {
  to: "jane@example.com",
  subject: "Your StratScope API key",
  text: "Here is your API key: sk_live_abc\nUse it with the Authorization header.\n\nThanks",
};

describe("runSmtp", () => {
  it("speaks the full SMTP transcript and sends the message", async () => {
    const socket = happySocket();
    await runSmtp(socket, CONFIG, MESSAGE);

    const transcript = socket.transcript();
    expect(transcript).toContain("EHLO stratscope-api\r\n");
    expect(transcript).toContain(`AUTH PLAIN ${btoa("\u0000owner@stratscope.app\u0000app-pass-123")}\r\n`);
    expect(transcript).toContain("MAIL FROM:<no-reply@stratscope.app>\r\n");
    expect(transcript).toContain("RCPT TO:<jane@example.com>\r\n");
    expect(transcript).toContain("DATA\r\n");
    expect(transcript).toContain(
      "From: no-reply@stratscope.app\r\nTo: jane@example.com\r\nSubject: Your StratScope API key\r\n" +
        "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
        "Here is your API key: sk_live_abc\r\nUse it with the Authorization header.\r\n\r\nThanks\r\n.\r\n"
    );
    expect(transcript.endsWith("QUIT\r\n")).toBe(true);
  });

  it("maps a 535 auth reply to EmailError SMTP_AUTH_FAILED", async () => {
    const socket = new FakeSocket([
      "220 smtp.gmail.com ESMTP ready",
      "250-smtp.gmail.com at your service",
      "250 ENHANCEDSTATUSCODES",
      "535 5.7.8 Username and Password not accepted.",
    ]);

    await expect(runSmtp(socket, CONFIG, MESSAGE)).rejects.toMatchObject({
      name: "EmailError",
      code: "SMTP_AUTH_FAILED",
    });
  });

  it("maps a 5xx reply during DATA to EmailError SMTP_REJECTED", async () => {
    const socket = new FakeSocket([
      "220 smtp.gmail.com ESMTP ready",
      "250-smtp.gmail.com at your service",
      "250 ENHANCEDSTATUSCODES",
      "235 2.7.0 Accepted",
      "250 2.1.0 Ok",
      "250 2.1.5 Ok",
      "354 End data with <CR><LF>.<CR><LF>",
      "550 5.7.1 Message rejected",
    ]);

    await expect(runSmtp(socket, CONFIG, MESSAGE)).rejects.toMatchObject({
      name: "EmailError",
      code: "SMTP_REJECTED",
    });
  });

  it("throws EmailError SMTP_TIMEOUT when the server never replies", async () => {
    const neverReadable = new ReadableStream({
      start() {
        // Never enqueue data and never close: the read must time out.
      },
    });
    const socket = new FakeSocket([], neverReadable);

    await expect(runSmtp(socket, CONFIG, MESSAGE, 30)).rejects.toMatchObject({
      name: "EmailError",
      code: "SMTP_TIMEOUT",
    });
  });

  it("dot-stuffs message lines that start with a dot", async () => {
    const socket = happySocket();
    await runSmtp(socket, CONFIG, { ...MESSAGE, text: ".lead line\nnormal\n..literal" });

    const transcript = socket.transcript();
    expect(transcript).toContain("..lead line\r\nnormal\r\n...literal\r\n.\r\n");
  });
});

describe("sendEmail", () => {
  it("throws EmailError SMTP_CONFIG_MISSING when SMTP credentials are absent", async () => {
    const env: Env = { ENVIRONMENT: "test" };
    const unexpectedFactory = (): SmtpSocketLike => {
      throw new Error("socket factory must not be called without config");
    };

    await expect(sendEmail(env, MESSAGE, unexpectedFactory)).rejects.toMatchObject({
      name: "EmailError",
      code: "SMTP_CONFIG_MISSING",
    });
  });

  it("throws EmailError SMTP_CONFIG_MISSING when only SMTP_USER is set", async () => {
    const env: Env = { ENVIRONMENT: "test", SMTP_USER: "owner@stratscope.app" };
    await expect(sendEmail(env, MESSAGE, () => happySocket())).rejects.toMatchObject({
      name: "EmailError",
      code: "SMTP_CONFIG_MISSING",
    });
  });

  it("sends through an injected socket factory and closes the socket", async () => {
    const env: Env = {
      ENVIRONMENT: "test",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: 465,
      SMTP_USER: "owner@stratscope.app",
      SMTP_APP_PASSWORD: "app-pass-123",
      SMTP_FROM: "no-reply@stratscope.app",
    };
    const socket = happySocket();
    let factoryHost = "";
    let factoryPort = 0;

    await sendEmail(env, MESSAGE, (host, port) => {
      factoryHost = host;
      factoryPort = port;
      return socket;
    });

    expect(factoryHost).toBe("smtp.gmail.com");
    expect(factoryPort).toBe(465);
    expect(socket.transcript()).toContain(`AUTH PLAIN ${btoa("\u0000owner@stratscope.app\u0000app-pass-123")}`);
    expect(socket.closeCalls.length).toBe(1);
  });

  it("defaults the From address to SMTP_USER", async () => {
    const env: Env = {
      ENVIRONMENT: "test",
      SMTP_USER: "owner@stratscope.app",
      SMTP_APP_PASSWORD: "app-pass-123",
    };
    const socket = happySocket();
    await sendEmail(env, MESSAGE, () => socket);

    expect(socket.transcript()).toContain("MAIL FROM:<owner@stratscope.app>\r\n");
    expect(socket.transcript()).toContain("From: owner@stratscope.app\r\n");
  });
});
