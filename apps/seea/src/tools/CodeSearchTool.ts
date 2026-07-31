import * as fs from "fs/promises";
import * as path from "path";
import type { Tool, ToolResult } from "./ToolRegistry.js";

export class CodeSearchTool implements Tool {
  readonly name = "code_search";
  readonly description = "Search for code patterns using regex";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = (input.path as string) || ".";
    const pattern = input.pattern as string;
    const fileExtensions = (input.extensions as string[]) || [".ts", ".tsx", ".js", ".jsx"];

    try {
      const regex = new RegExp(pattern, "g");
      const results: string[] = [];

      async function walk(dir: string): Promise<void> {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith(".") || item.name === "node_modules") continue;

          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await walk(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name);
            if (fileExtensions.includes(ext)) {
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                const lines = content.split("\n");
                lines.forEach((line: string, idx: number) => {
                  if (regex.test(line)) {
                    results.push(`${fullPath}:${idx + 1}: ${line.trim()}`);
                    regex.lastIndex = 0;
                  }
                });
              } catch {
                // Skip binary files
              }
            }
          }
        }
      }

      await walk(dirPath);
      return {
        success: true,
        output: results.length > 0 ? results.join("\n") : "No matches found",
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
