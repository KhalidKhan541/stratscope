import { ExecutionLoop, type ExecutionLoopConfig } from "./agent/ExecutionLoop.js";
import { CloudflareRecorder } from "./recorder/CloudflareRecorder.js";
import type { SeeaAgentDeps, Recorder } from "./agent/SeeaAgent.js";
import type { ExecutionContext, DecisionRecord, FailureRecord, Task, TaskResult, Plan } from "./types.js";
import type { ExecutionStartData, ExecutionCompleteData, EvaluationData, ReflectionData } from "./recorder/ExecutionRecorder.js";
import type { EvaluationResult } from "./evaluator/Evaluator.js";
import type { ReflectionResult } from "./reflector/Reflector.js";

function getConfig(): ExecutionLoopConfig {
  return {
    apiBaseUrl: process.env["STRATSCOPE_API_URL"] ?? "https://api.stratscope.ai",
    apiKey: process.env["STRATSCOPE_API_KEY"] ?? "",
    projectId: process.env["STRATSCOPE_PROJECT_ID"] ?? "",
    organizationId: process.env["STRATSCOPE_ORG_ID"] ?? "",
    agentId: process.env["STRATSCOPE_AGENT_ID"] ?? "",
    maxRetries: 3,
    maxTokens: 4096,
    model: "llama-3.3-70b-versatile",
    workspaceDir: process.env["SEE_WORKSPACE"] ?? "./workspace",
    maxIterations: Number(process.env["MAX_ITERATIONS"] ?? "5"),
    delayBetweenIterationsMs: 2000,
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

async function main(): Promise<void> {
  console.log("[SEEA] Starting Software Engineering Execution Agent");

  const config = getConfig();

  if (!config.apiKey) {
    console.error("[SEEA] STRATSCOPE_API_KEY is required");
    process.exit(1);
  }

  const recorder = wrapRecorder(new CloudflareRecorder(config.apiBaseUrl, config.apiKey));

  const loop = new ExecutionLoop(config, (): SeeaAgentDeps => ({
    recorder,
    planner: {
      plan: async (_task: Task): Promise<Plan> => ({
        steps: [],
        estimated_duration_ms: 0,
        risk_level: "low",
      }),
    },
    evaluator: {
      evaluate: async (_result: TaskResult, _context: ExecutionContext): Promise<EvaluationResult> => ({
        score: 0,
        issues: [],
        suggestions: [],
        should_retry: false,
        metrics: {
          task_completion: 0,
          code_quality: 0,
          test_success: false,
          build_success: false,
          security_findings: [],
          performance_impact: "unknown",
          execution_duration_ms: 0,
          cost_usd: 0,
          tokens_used: 0,
        },
      }),
    },
    reflector: {
      reflect: async (_result: TaskResult, _evaluation: EvaluationResult, _context: ExecutionContext): Promise<ReflectionResult> => ({
        what_worked: [],
        what_failed: [],
        what_slowed_down: [],
        tools_effective: [],
        model_choices_effective: [],
        improvements: [],
        summary: "Pending implementation",
      }),
    },
    taskPicker: { pickTask: async () => null },
    taskExecutor: {
      executePlan: async (_task: Task, _plan: Plan, _context: ExecutionContext): Promise<TaskResult> => ({
        task_id: "",
        status: "cancelled",
        output: "",
        changes: [],
        duration_ms: 0,
        tokens_used: 0,
        cost_usd: 0,
        model_used: "",
        tools_used: [],
        errors: [],
        retry_count: 0,
      }),
    },
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
