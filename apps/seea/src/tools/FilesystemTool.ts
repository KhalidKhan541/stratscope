import * as fs from "fs/promises";
import * as path from "path";
import type { Tool, ToolResult } from "./ToolRegistry.js";

export class ReadFileTool implements Tool {
  readonly name = "read_file";
  readonly description = "Read contents of a file";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = input.path as string;
    const offset = (input.offset as number) || 0;
    const limit = (input.limit as number) || 1000;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const sliced = lines.slice(offset, offset + limit);
      return {
        success: true,
        output: sliced.join("\n"),
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

export class WriteFileTool implements Tool {
  readonly name = "write_file";
  readonly description = "Write content to a file";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = input.path as string;
    const content = input.content as string;

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      return {
        success: true,
        output: `Written ${content.length} bytes to ${filePath}`,
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

export class ListFilesTool implements Tool {
  readonly name = "list_files";
  readonly description = "List files in a directory";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = (input.path as string) || ".";
    const recursive = (input.recursive as boolean) || false;

    try {
      const entries: string[] = [];

      async function walk(dir: string, prefix: string = ""): Promise<void> {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const relativePath = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.isDirectory()) {
            entries.push(`${relativePath}/`);
            if (recursive) {
              await walk(path.join(dir, item.name), relativePath);
            }
          } else {
            entries.push(relativePath);
          }
        }
      }

      await walk(dirPath);
      return {
        success: true,
        output: entries.join("\n"),
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

export class SearchFilesTool implements Tool {
  readonly name = "search_files";
  readonly description = "Search for a pattern in files";

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = (input.path as string) || ".";
    const pattern = input.pattern as string;

    try {
      const results: string[] = [];

      async function walk(dir: string): Promise<void> {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith(".") || item.name === "node_modules") continue;

          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await walk(fullPath);
          } else if (item.isFile()) {
            try {
              const content = await fs.readFile(fullPath, "utf-8");
              const lines = content.split("\n");
              lines.forEach((line: string, idx: number) => {
                if (line.includes(pattern)) {
                  results.push(`${fullPath}:${idx + 1}: ${line.trim()}`);
                }
              });
            } catch {
              // Skip binary files
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
