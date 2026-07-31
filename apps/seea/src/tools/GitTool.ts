import { exec } from "child_process";
import { promisify } from "util";
import type { Tool, ToolResult } from "./ToolRegistry.js";

const execAsync = promisify(exec);

async function runGit(command: string, cwd: string): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(`git ${command}`, {
      cwd,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    return {
      success: true,
      output: stdout || stderr,
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

export class GitStatusTool implements Tool {
  readonly name = "git_status";
  readonly description = "Get git status of a repository";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return runGit("status --porcelain", input.cwd as string);
  }
}

export class GitDiffTool implements Tool {
  readonly name = "git_diff";
  readonly description = "Get git diff";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const args = (input.args as string) || "";
    return runGit(`diff ${args}`, input.cwd as string);
  }
}

export class GitLogTool implements Tool {
  readonly name = "git_log";
  readonly description = "Get git log";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const count = (input.count as number) || 10;
    return runGit(`log --oneline -${count}`, input.cwd as string);
  }
}

export class GitCommitTool implements Tool {
  readonly name = "git_commit";
  readonly description = "Create a git commit";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const message = input.message as string;
    const addAll = input.add_all as boolean;

    if (addAll) {
      await runGit("add -A", input.cwd as string);
    }
    return runGit(`commit -m "${message}"`, input.cwd as string);
  }
}

export class GitBranchTool implements Tool {
  readonly name = "git_branch";
  readonly description = "Create and switch to a new branch";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const branch = input.branch as string;
    return runGit(`checkout -b ${branch}`, input.cwd as string);
  }
}
