import * as fs from "fs/promises";
import * as path from "path";
import { ExecutionLoop, type ExecutionLoopConfig } from "./agent/ExecutionLoop.js";
import type {
  Recorder,
  SeeaAgentDeps,
  Planner as PlannerPort,
  Evaluator as EvaluatorPort,
  Reflector as ReflectorPort,
  TaskPicker as TaskPickerPort,
  TaskExecutor as TaskExecutorPort,
} from "./agent/SeeaAgent.js";
import type { ExecutionContext, DecisionRecord, FailureRecord, Task, TaskResult, Plan } from "./types.js";
import type { ExecutionStartData, ExecutionCompleteData, EvaluationData, ReflectionData } from "./recorder/ExecutionRecorder.js";
import { CloudflareRecorder } from "./recorder/CloudflareRecorder.js";
import type { EvaluationResult } from "./evaluator/Evaluator.js";
import { Evaluator } from "./evaluator/Evaluator.js";
import type { ReflectionResult } from "./reflector/Reflector.js";
import { Reflector } from "./reflector/Reflector.js";
import type { Plan as PlannerPlan, PlanStep as PlannerStep } from "./planner/Planner.js";
import { Planner } from "./planner/Planner.js";
import { GroqProvider } from "./model/GroqProvider.js";
import { ModelRouter } from "./model/ModelRouter.js";
import { TaskPool } from "./tasks/TaskPool.js";
import { TaskPicker } from "./tasks/TaskPicker.js";
import { ToolRegistry } from "./tools/ToolRegistry.js";
import { TerminalTool, TestRunnerTool, LintRunnerTool } from "./tools/TerminalTool.js";
import { ReadFileTool, WriteFileTool, ListFilesTool, SearchFilesTool } from "./tools/FilesystemTool.js";
import { GitStatusTool, GitDiffTool, GitLogTool, GitCommitTool, GitBranchTool } from "./tools/GitTool.js";
import { CodeSearchTool } from "./tools/CodeSearchTool.js";

interface SeeaConfig extends ExecutionLoopConfig {
  readonly taskPoolPath: string;
}

interface ToolRecorder {
  recordToolCall(
    executionId: string,
    toolName: string,
    input: Record<string, unknown>,
    output: string,
    durationMs: number,
    success: boolean,
  ): Promise<void>;
}

function getConfig(): SeeaConfig {
  const workspaceDir = process.env["SEE_WORKSPACE"] ?? "./workspace";

  return {
    apiBaseUrl: process.env["STRATSCOPE_API_URL"] ?? "https://api.stratscope.ai",
    apiKey: process.env["STRATSCOPE_API_KEY"] ?? "",
    projectId: process.env["STRATSCOPE_PROJECT_ID"] ?? "",
    organizationId: process.env["STRATSCOPE_ORG_ID"] ?? "",
    agentId: process.env["STRATSCOPE_AGENT_ID"] ?? "",
    maxRetries: 3,
    maxTokens: 4096,
    model: process.env["MODEL"] ?? "llama-3.3-70b-versatile",
    workspaceDir,
    maxIterations: Number(process.env["MAX_ITERATIONS"] ?? "5"),
    delayBetweenIterationsMs: 2000,
    taskPoolPath: process.env["SEE_TASK_POOL"] ?? path.join(workspaceDir, "task-pool.json"),
  };
}

function wrapRecorder(cr: CloudflareRecorder): Recorder {
  return {
    recordExecutionStart: async (data: ExecutionStartData) => {
      await cr.recordExecutionStart(data);
    },
    recordDecision: async (context: ExecutionContext, decision: DecisionRecord) => {
      await cr.recordDecision(context, decision);
    },
    recordFailure: async (context: ExecutionContext, failure: FailureRecord) => {
      await cr.recordFailure(context, failure);
    },
    recordExecutionComplete: async (context: ExecutionContext, data: ExecutionCompleteData) => {
      await cr.recordExecutionComplete(context, data);
    },
    recordEvaluation: async (data: EvaluationData) => {
      await cr.recordEvaluation(data);
    },
    recordReflection: async (data: ReflectionData) => {
      await cr.recordReflection(data);
    },
  };
}

function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(new TerminalTool());
  registry.register(new TestRunnerTool());
  registry.register(new LintRunnerTool());
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new ListFilesTool());
  registry.register(new SearchFilesTool());
  registry.register(new GitStatusTool());
  registry.register(new GitDiffTool());
  registry.register(new GitLogTool());
  registry.register(new GitCommitTool());
  registry.register(new GitBranchTool());
  registry.register(new CodeSearchTool());

  return registry;
}

function defaultToolForAction(action: string): string {
  switch (action) {
    case "analyze":
      return "list_files";
    case "search":
      return "code_search";
    case "implement":
      return "write_file";
    case "test":
    case "verify":
      return "test_runner";
    default:
      return "terminal";
  }
}

function buildArgs(step: PlannerStep): Record<string, unknown> {
  const tool = step.tools_required[0] ?? defaultToolForAction(step.action);

  switch (tool) {
    case "read_file":
      return { path: step.target };
    case "write_file":
      return { path: step.target, content: step.reason };
    case "list_files":
      return { path: step.target === "codebase" ? "." : step.target, recursive: true };
    case "search_files":
    case "code_search":
      return { path: ".", pattern: step.target };
    case "terminal":
      return { command: `echo "[SEEA] ${step.action}: ${step.target}"`, timeout: 15000 };
    default:
      return {};
  }
}

function toAgentPlan(plan: PlannerPlan): Plan {
  const riskLevel: "low" | "medium" | "high" =
    plan.estimated_complexity === "hard"
      ? "high"
      : plan.estimated_complexity === "medium"
        ? "medium"
        : "low";

  return {
    steps: plan.steps.map((step) => ({
      id: step.id,
      action: step.action,
      tool: step.tools_required[0] ?? defaultToolForAction(step.action),
      args: buildArgs(step),
      depends_on: [...step.dependencies],
    })),
    estimated_duration_ms: plan.steps.length * 60_000,
    risk_level: riskLevel,
  };
}

class ToolBasedTaskExecutor implements TaskExecutorPort {
  private registry: ToolRegistry;
  private workspaceDir: string;
  private toolRecorder?: ToolRecorder;

  constructor(registry: ToolRegistry, workspaceDir: string, toolRecorder?: ToolRecorder) {
    this.registry = registry;
    this.workspaceDir = workspaceDir;
    this.toolRecorder = toolRecorder;
  }

  async executePlan(task: Task, plan: Plan, context: ExecutionContext): Promise<TaskResult> {
    const start = Date.now();
    const toolsUsed: string[] = [];
    const errors: string[] = [];
    const outputs: string[] = [];

    for (const step of plan.steps) {
      const toolName = step.tool || "terminal";
      const args: Record<string, unknown> = { ...step.args, cwd: this.workspaceDir };
      console.log(`[SEEA] Executing step ${step.id} (${step.action}) via '${toolName}'`);

      const result = await this.registry.execute(toolName, args);
      toolsUsed.push(toolName);

      if (this.toolRecorder) {
        try {
          await this.toolRecorder.recordToolCall(
            context.executionId,
            toolName,
            args,
            result.output,
            result.duration_ms ?? 0,
            result.success,
          );
        } catch (error) {
          console.error("[SEEA] Failed to record tool call:", error);
        }
      }

      if (result.success) {
        outputs.push(`[${step.id}] ${result.output}`);
      } else {
        const message = result.error ?? "unknown error";
        errors.push(`step ${step.id} (${toolName}): ${message}`);
        console.error(`[SEEA] Step ${step.id} failed: ${message}`);
      }
    }

    return {
      task_id: task.id,
      status: errors.length === 0 ? "completed" : "failed",
      output: outputs.join("\n"),
      changes: [],
      duration_ms: Date.now() - start,
      tokens_used: 0,
      cost_usd: 0,
      model_used: "",
      tools_used: toolsUsed,
      errors,
      retry_count: 0,
    };
  }
}

function createDryRunPlanner(): PlannerPort {
  return {
    plan: async (task: Task): Promise<Plan> => ({
      steps: [
        {
          id: "step_0",
          action: "analyze",
          tool: "list_files",
          args: { path: ".", recursive: false },
          depends_on: [],
        },
        {
          id: "step_1",
          action: "implement",
          tool: "terminal",
          args: {
            command: `echo "[SEEA] dry-run: task ${task.id} (${task.title}) skipped - no GROQ_API_KEY"`,
            timeout: 15000,
          },
          depends_on: ["step_0"],
        },
      ],
      estimated_duration_ms: 30_000,
      risk_level: "low",
    }),
  };
}

function createDryRunEvaluator(): EvaluatorPort {
  return {
    evaluate: async (result: TaskResult, _context: ExecutionContext): Promise<EvaluationResult> => {
      const completed = result.status === "completed";

      return {
        score: completed ? 80 : 30,
        issues: result.errors.map((e) => ({ severity: "error" as const, description: e })),
        suggestions: completed ? ["Add GROQ_API_KEY to enable LLM evaluation"] : [],
        should_retry: !completed,
        metrics: {
          task_completion: completed ? 100 : 0,
          code_quality: 50,
          test_success: result.tools_used.includes("test_runner") && result.errors.length === 0,
          build_success: result.errors.length === 0,
          security_findings: [],
          performance_impact: "unknown",
          execution_duration_ms: result.duration_ms,
          cost_usd: result.cost_usd,
          tokens_used: result.tokens_used,
        },
      };
    },
  };
}

function createDryRunReflector(): ReflectorPort {
  return {
    reflect: async (
      result: TaskResult,
      evaluation: EvaluationResult,
      _context: ExecutionContext,
    ): Promise<ReflectionResult> => ({
      what_worked: result.status === "completed" ? ["Task completed"] : [],
      what_failed: result.errors.length > 0 ? [...result.errors] : [],
      what_slowed_down: [],
      tools_effective: result.tools_used.map((tool) => ({
        tool,
        reason: "used during dry-run",
        used_count: 1,
      })),
      model_choices_effective: [],
      improvements:
        evaluation.suggestions.length > 0
          ? [...evaluation.suggestions]
          : ["Provide GROQ_API_KEY for LLM-based reflection"],
      summary:
        result.status === "completed"
          ? "Dry-run completed successfully"
          : "Dry-run completed with errors",
    }),
  };
}

async function main(): Promise<void> {
  console.log("[SEEA] Starting Software Engineering Execution Agent");

  const config = getConfig();

  if (!config.apiKey) {
    console.error("[SEEA] STRATSCOPE_API_KEY is required");
    process.exit(1);
  }

  const groqApiKey = process.env["GROQ_API_KEY"];
  if (!groqApiKey) {
    console.warn("[SEEA] GROQ_API_KEY not set, running in dry-run mode");
  }

  await fs.mkdir(config.workspaceDir, { recursive: true });

  const cloudflareRecorder = new CloudflareRecorder(config.apiBaseUrl, config.apiKey);
  const recorder = wrapRecorder(cloudflareRecorder);

  const pool = new TaskPool(config.taskPoolPath);
  await pool.load();

  const picker = new TaskPicker(pool, "random");
  const taskPicker: TaskPickerPort = {
    pickTask: () => picker.pick(),
  };

  const registry = createToolRegistry();
  const taskExecutor = new ToolBasedTaskExecutor(registry, config.workspaceDir, cloudflareRecorder);

  let plannerPort: PlannerPort;
  let evaluatorPort: EvaluatorPort;
  let reflectorPort: ReflectorPort;

  if (groqApiKey) {
    console.log(`[SEEA] Using Groq provider with model '${config.model}'`);

    const router = new ModelRouter(config.model);
    router.registerProvider("groq", new GroqProvider(groqApiKey));

    const planner = new Planner(router);
    const evaluator = new Evaluator(router);
    const reflector = new Reflector(router);

    plannerPort = {
      plan: async (task: Task): Promise<Plan> => toAgentPlan(await planner.plan(task)),
    };
    evaluatorPort = evaluator;
    reflectorPort = reflector;
  } else {
    plannerPort = createDryRunPlanner();
    evaluatorPort = createDryRunEvaluator();
    reflectorPort = createDryRunReflector();
  }

  const loop = new ExecutionLoop(config, (): SeeaAgentDeps => ({
    recorder,
    planner: plannerPort,
    evaluator: evaluatorPort,
    reflector: reflectorPort,
    taskPicker,
    taskExecutor,
  }));

  const result = await loop.run();

  console.log("[SEEA] Run complete:", JSON.stringify(result, null, 2));

  if (result.failedTasks > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[SEEA] Fatal error:", error);
  process.exit(1);
});
