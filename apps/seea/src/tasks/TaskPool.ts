import * as fs from "fs/promises";
import * as path from "path";
import type { Task, TaskType } from "../types.js";

export class TaskPool {
  private tasks: Task[] = [];
  private completedTaskIds: Set<string> = new Set();
  private poolPath: string;

  constructor(poolPath: string) {
    this.poolPath = poolPath;
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.poolPath, "utf-8");
      this.tasks = JSON.parse(content) as Task[];
      console.log(`[TaskPool] Loaded ${this.tasks.length} tasks`);
    } catch {
      console.log("[TaskPool] No task pool found, using defaults");
      this.tasks = this.getDefaultTasks();
      await this.save();
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.poolPath), { recursive: true });
    await fs.writeFile(this.poolPath, JSON.stringify(this.tasks, null, 2));
  }

  async pickRandom(): Promise<Task | null> {
    const available = this.tasks.filter(t => !this.completedTaskIds.has(t.id));
    if (available.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * available.length);
    return available[index] ?? null;
  }

  async pickByType(type: TaskType): Promise<Task | null> {
    const available = this.tasks.filter(
      t => t.type === type && !this.completedTaskIds.has(t.id)
    );
    if (available.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * available.length);
    return available[index] ?? null;
  }

  markCompleted(taskId: string): void {
    this.completedTaskIds.add(taskId);
  }

  getStats(): { total: number; completed: number; remaining: number } {
    return {
      total: this.tasks.length,
      completed: this.completedTaskIds.size,
      remaining: this.tasks.length - this.completedTaskIds.size,
    };
  }

  private getDefaultTasks(): Task[] {
    return [
      {
        id: "task_001",
        type: "bug_fix",
        title: "Fix null pointer in user authentication",
        description: "The login endpoint crashes when email is missing. Add proper null checks and return appropriate error messages.",
        repository: "https://github.com/example/auth-service",
        file_paths: ["src/auth/login.ts", "src/auth/validate.ts"],
        difficulty: "easy",
        tags: ["auth", "null-safety", "error-handling"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_002",
        type: "feature_implementation",
        title: "Add rate limiting to API endpoints",
        description: "Implement rate limiting middleware using a sliding window algorithm. Limit to 100 requests per minute per API key.",
        repository: "https://github.com/example/api-gateway",
        file_paths: ["src/middleware/rateLimit.ts"],
        difficulty: "medium",
        tags: ["middleware", "security", "performance"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_003",
        type: "refactoring",
        title: "Extract database queries into repository pattern",
        description: "The service layer contains raw SQL queries. Refactor to use a repository pattern with proper interfaces.",
        repository: "https://github.com/example/user-service",
        file_paths: ["src/services/userService.ts", "src/repositories/userRepository.ts"],
        difficulty: "medium",
        tags: ["refactoring", "architecture", "clean-code"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_004",
        type: "test_generation",
        title: "Write unit tests for payment processing",
        description: "The payment module has no tests. Write comprehensive unit tests covering success, failure, and edge cases.",
        repository: "https://github.com/example/payment-service",
        file_paths: ["src/payment/process.ts"],
        difficulty: "medium",
        tags: ["testing", "payments", "unit-tests"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_005",
        type: "documentation",
        title: "Add JSDoc to public API functions",
        description: "The public API functions lack documentation. Add comprehensive JSDoc with examples and parameter descriptions.",
        repository: "https://github.com/example/sdk",
        file_paths: ["src/index.ts", "src/client.ts"],
        difficulty: "easy",
        tags: ["documentation", "api", "jsdoc"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_006",
        type: "security_review",
        title: "Fix SQL injection vulnerabilities",
        description: "Several endpoints use string interpolation for SQL queries. Convert to parameterized queries.",
        repository: "https://github.com/example/legacy-api",
        file_paths: ["src/db/queries.ts"],
        difficulty: "hard",
        tags: ["security", "sql-injection", "critical"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_007",
        type: "performance_optimization",
        title: "Optimize N+1 query in user listing",
        description: "The user listing endpoint makes N+1 queries. Implement eager loading or batch fetching.",
        repository: "https://github.com/example/admin-panel",
        file_paths: ["src/controllers/userController.ts"],
        difficulty: "medium",
        tags: ["performance", "database", "n+1"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_008",
        type: "dependency_upgrade",
        title: "Upgrade TypeScript to v5.5",
        description: "Upgrade TypeScript from 5.0 to 5.5 and fix any breaking changes.",
        repository: "https://github.com/example/frontend",
        file_paths: ["package.json", "tsconfig.json"],
        difficulty: "medium",
        tags: ["dependencies", "typescript", "upgrade"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_009",
        type: "code_review",
        title: "Review PR for new authentication flow",
        description: "Review the pull request implementing OAuth2 authentication. Check for security issues, code quality, and test coverage.",
        repository: "https://github.com/example/auth-service",
        file_paths: ["src/auth/oauth.ts"],
        difficulty: "hard",
        tags: ["review", "auth", "security"],
        created_at: new Date().toISOString(),
      },
      {
        id: "task_010",
        type: "bug_fix",
        title: "Fix race condition in concurrent writes",
        description: "Two concurrent requests can corrupt data. Implement proper locking or optimistic concurrency control.",
        repository: "https://github.com/example/data-service",
        file_paths: ["src/data/write.ts"],
        difficulty: "hard",
        tags: ["concurrency", "race-condition", "data-integrity"],
        created_at: new Date().toISOString(),
      },
    ];
  }
}
