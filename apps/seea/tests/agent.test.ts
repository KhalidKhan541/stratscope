import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState, updateState } from "../src/agent/AgentState.js";
import { ToolRegistry } from "../src/tools/ToolRegistry.js";
import type { Tool } from "../src/tools/ToolRegistry.js";
import { TaskPool } from "../src/tasks/TaskPool.js";
import { TaskPicker } from "../src/tasks/TaskPicker.js";
import { DatasetGenerator } from "../src/tasks/DatasetGenerator.js";
import type {
  TaskResult,
  ExecutionContext,
  EvaluationResult,
  ReflectionResult,
} from "../src/types.js";

describe("AgentState", () => {
  it("should create initial state", () => {
    const state = createInitialState();
    expect(state.currentTask).toBeNull();
    expect(state.currentResult).toBeNull();
    expect(state.completedTasks).toEqual([]);
    expect(state.failedTasks).toEqual([]);
    expect(state.totalTokensUsed).toBe(0);
    expect(state.totalCostUsd).toBe(0);
  });

  it("should update state immutably", () => {
    const initial = createInitialState();
    const updated = updateState(initial, { totalTokensUsed: 100 });
    expect(updated.totalTokensUsed).toBe(100);
    expect(initial.totalTokensUsed).toBe(0);
  });
});

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("should register and retrieve tools", () => {
    const mockTool: Tool = {
      name: "test_tool",
      description: "A test tool",
      execute: async () => ({ success: true, output: "test", duration_ms: 0 }),
    };

    registry.register(mockTool);
    expect(registry.get("test_tool")).toBe(mockTool);
    expect(registry.list()).toHaveLength(1);
  });

  it("should execute tools", async () => {
    const mockTool: Tool = {
      name: "test_tool",
      description: "A test tool",
      execute: async () => ({ success: true, output: "result", duration_ms: 100 }),
    };

    registry.register(mockTool);
    const result = await registry.execute("test_tool", {});
    expect(result.success).toBe(true);
    expect(result.output).toBe("result");
  });

  it("should handle missing tools", async () => {
    const result = await registry.execute("nonexistent", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("should handle tool errors", async () => {
    const errorTool: Tool = {
      name: "error_tool",
      description: "A tool that errors",
      execute: async () => {
        throw new Error("Tool error");
      },
    };

    registry.register(errorTool);
    const result = await registry.execute("error_tool", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool error");
  });
});

describe("DatasetGenerator", () => {
  let generator: DatasetGenerator;

  beforeEach(() => {
    generator = new DatasetGenerator();
  });

  it("should add records", () => {
    const mockResult: TaskResult = {
      task_id: "task_1",
      status: "completed",
      output: "test output",
      changes: [],
      duration_ms: 1000,
      tokens_used: 500,
      cost_usd: 0.001,
      model_used: "test-model",
      tools_used: ["read_file"],
      errors: [],
      retry_count: 0,
    };

    const mockContext: ExecutionContext = {
      executionId: "exec_1",
      taskId: "task_1",
      startTime: Date.now(),
      events: [],
      decisions: [],
      failures: [],
    };

    const mockEvaluation: EvaluationResult = {
      score: 85,
      dimensions: [],
      pass: true,
      feedback: "Good execution",
    };

    const mockReflection: ReflectionResult = {
      insights: ["Task completed successfully"],
      lessons_learned: [],
      recommendations: [],
      confidence: 0.9,
    };

    generator.addRecord(mockResult, mockContext, mockEvaluation, mockReflection);
    expect(generator.getRecords()).toHaveLength(1);
  });

  it("should export JSONL", () => {
    const mockResult: TaskResult = {
      task_id: "task_1",
      status: "completed",
      output: "test",
      changes: [],
      duration_ms: 1000,
      tokens_used: 500,
      cost_usd: 0.001,
      model_used: "test-model",
      tools_used: [],
      errors: [],
      retry_count: 0,
    };

    const mockContext: ExecutionContext = {
      executionId: "exec_1",
      taskId: "task_1",
      startTime: Date.now(),
      events: [],
      decisions: [],
      failures: [],
    };

    const mockEvaluation: EvaluationResult = {
      score: 85,
      dimensions: [],
      pass: true,
      feedback: "Good",
    };

    const mockReflection: ReflectionResult = {
      insights: [],
      lessons_learned: [],
      recommendations: [],
      confidence: 0.8,
    };

    generator.addRecord(mockResult, mockContext, mockEvaluation, mockReflection);
    const jsonl = generator.exportJSONL();
    expect(jsonl).toContain("task_1");
  });

  it("should generate metadata", () => {
    const metadata = generator.getMetadata();
    expect(metadata.name).toBe("seea-execution-dataset");
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.record_count).toBe(0);
  });
});

describe("TaskPool", () => {
  it("should have default tasks", async () => {
    const pool = new TaskPool("./nonexistent.json");
    await pool.load();
    const stats = pool.getStats();
    expect(stats.total).toBeGreaterThan(0);
  });

  it("should pick random task", async () => {
    const pool = new TaskPool("./nonexistent.json");
    await pool.load();
    const task = await pool.pickRandom();
    expect(task).not.toBeNull();
    expect(task?.id).toBeDefined();
  });

  it("should track completed tasks", async () => {
    const pool = new TaskPool("./nonexistent.json");
    await pool.load();
    const task = await pool.pickRandom();
    if (task) {
      pool.markCompleted(task.id);
      const stats = pool.getStats();
      expect(stats.completed).toBe(1);
    }
  });
});

describe("TaskPicker", () => {
  it("should pick random task", async () => {
    const pool = new TaskPool("./nonexistent.json");
    await pool.load();
    const picker = new TaskPicker(pool, "random");
    const task = await picker.pick();
    expect(task).not.toBeNull();
  });
});
