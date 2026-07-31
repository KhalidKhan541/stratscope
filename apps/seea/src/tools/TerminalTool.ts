import { exec } from "child_process";
import { promisify } from "util";
import type { Tool, ToolResult } from "./ToolRegistry.js";

const execAsync = promisify(exec);

export class TerminalTool implements Tool {
  readonly name = "terminal";
  readonly description = "Execute a terminal command";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const command = input.command as string;
    const cwd = (input.cwd as string) || ".";
    const timeout = (input.timeout as number) || 30000;

    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, NODE_ENV: "test" },
      });

      return {
        success: true,
        output: stdout || stderr || "(no output)",
        duration_ms: Date.now() - start,
      };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message: string };
      return {
        success: false,
        output: err.stdout || "",
        error: err.stderr || err.message,
        duration_ms: Date.now() - start,
      };
    }
  }
}

export class TestRunnerTool implements Tool {
  readonly name = "test_runner";
  readonly description = "Run tests";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const cwd = (input.cwd as string) || ".";
    const testCommand = (input.command as string) || "npm test";

    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(testCommand, {
        cwd,
        timeout: 120000,
        maxBuffer: 2 * 1024 * 1024,
      });

      return {
        success: true,
        output: stdout,
        duration_ms: Date.now() - start,
      };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message: string };
      return {
        success: false,
        output: err.stdout || "",
        error: err.stderr || err.message,
        duration_ms: Date.now() - start,
      };
    }
  }
}

export class LintRunnerTool implements Tool {
  readonly name = "lint_runner";
  readonly description = "Run linter";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const cwd = (input.cwd as string) || ".";
    const lintCommand = (input.command as string) || "npm run lint";

    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(lintCommand, {
        cwd,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      });

      return {
        success: true,
        output: stdout || stderr || "(no output)",
        duration_ms: Date.now() - start,
      };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message: string };
      return {
        success: false,
        output: err.stdout || "",
        error: err.stderr || err.message,
        duration_ms: Date.now() - start,
      };
    }
  }
}
