/**
 * In-memory fake D1 for integration tests of the access feature.
 *
 * Supports the SQL subset used by the access libs and routes:
 *  - SELECT * FROM t WHERE col = ?N AND ... ORDER BY col DESC LIMIT ?M
 *  - SELECT col FROM t WHERE ... (first-row)
 *  - INSERT INTO t (cols) VALUES (?N, ...)
 *  - UPDATE t SET col = ?N WHERE ... (equality on one column)
 *  - fallback: tests register custom handlers via .on(pattern, fn)
 */

import type { D1Database, D1Result } from "@cloudflare/workers-types";

export type Row = Record<string, unknown>;
type Handler = (params: unknown[]) => unknown;

const PLACEHOLDER = /^\?(\d+)$/;

interface WhereClause {
  column: string;
  op: "=" | "<";
  value: unknown;
  inValues?: unknown[];
}

function resolvePlaceholder(rhs: string, params: unknown[]): unknown {
  const placeholder = rhs.match(PLACEHOLDER);
  return placeholder ? params[Number(placeholder[1]) - 1] : rhs.replace(/^'|'$/g, "");
}

function parseWhere(sql: string, params: unknown[]): WhereClause[] {
  const conditions: WhereClause[] = [];
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|$)/i);
  if (!whereMatch) {
    return conditions;
  }
  const parts = whereMatch[1].split(/\s+AND\s+/i);
  for (const part of parts) {
    const eq = part.match(/^\s*([A-Za-z0-9_.]+)\s*=\s*(.+?)\s*$/);
    if (eq) {
      const column = eq[1].split(".").pop() ?? eq[1];
      conditions.push({ column, op: "=", value: resolvePlaceholder(eq[2], params) });
      continue;
    }
    const lt = part.match(/^\s*([A-Za-z0-9_.]+)\s*<\s*(.+?)\s*$/);
    if (lt) {
      const column = lt[1].split(".").pop() ?? lt[1];
      conditions.push({ column, op: "<", value: resolvePlaceholder(lt[2], params) });
      continue;
    }
    const inClause = part.match(/^\s*([A-Za-z0-9_.]+)\s+IN\s*\((.+?)\)\s*$/);
    if (inClause) {
      const column = inClause[1].split(".").pop() ?? inClause[1];
      const values = inClause[2]
        .split(",")
        .map((v) => resolvePlaceholder(v.trim(), params));
      conditions.push({ column, op: "=", value: values[0], inValues: values });
    }
  }
  return conditions;
}

function rowMatches(row: Row, clause: WhereClause): boolean {
  const actual = row[clause.column];
  if (clause.inValues) {
    return clause.inValues.includes(actual);
  }
  if (clause.op === "<") {
    return String(actual ?? "") < String(clause.value ?? "");
  }
  return actual === clause.value;
}

function parseOrderBy(sql: string): { column: string; desc: boolean } | null {
  const match = sql.match(/ORDER BY\s+([A-Za-z0-9_]+)\s*(ASC|DESC)?/i);
  if (!match) {
    return null;
  }
  return { column: match[1], desc: (match[2] ?? "ASC").toUpperCase() === "DESC" };
}

function parseLimit(sql: string, params: unknown[]): number | null {
  const match = sql.match(/LIMIT\s+(.+?)\s*$/i);
  if (!match) {
    return null;
  }
  const value = match[1];
  const placeholder = value.match(PLACEHOLDER);
  const limit = placeholder ? params[Number(placeholder[1]) - 1] : Number(value);
  return typeof limit === "number" ? limit : Number(limit);
}

function extractTable(sql: string): string {
  const match = sql.match(/FROM\s+([A-Za-z0-9_]+)/i);
  if (!match) {
    throw new Error(`No table found in SQL: ${sql}`);
  }
  return match[1];
}

interface JoinClause {
  table: string;
  onLeft: string;
  onRight: string;
}

function parseJoin(sql: string): JoinClause | null {
  const match = sql.match(
    /JOIN\s+([A-Za-z0-9_]+)(?:\s+[A-Za-z0-9_]+)?\s+ON\s+([A-Za-z0-9_.]+)\s*=\s*([A-Za-z0-9_.]+)/i
  );
  if (!match) {
    return null;
  }
  return { table: match[1], onLeft: match[2], onRight: match[3] };
}

function joinColumn(qualified: string): string {
  return qualified.split(".").pop() ?? qualified;
}

export class FakeD1 {
  readonly tables: Record<string, Row[]>;
  private handlers: Array<{ pattern: string; handler: Handler }> = [];

  constructor(tables: Record<string, Row[]>) {
    this.tables = {};
    for (const [name, rows] of Object.entries(tables)) {
      this.tables[name] = rows.map((row) => ({ ...row }));
    }
  }

  on(pattern: string, handler: Handler): void {
    this.handlers.push({ pattern, handler });
  }

  prepare(sql: string) {
    const d1 = this;

    const statement = {
      bind: (...params: unknown[]) => statement,
      first: async <T = unknown>(): Promise<T | null> => {
        const rows = await d1.runSelect(sql, []);
        return (rows[0] as T) ?? null;
      },
      all: async <T = unknown>(): Promise<{ results: T[]; meta: Record<string, unknown> }> => {
        const rows = await d1.runSelect(sql, []);
        return { results: rows as T[], meta: {} };
      },
      run: async () => {
        const changes = await d1.runWrite(sql, []);
        return { success: true, meta: { changes } };
      },
      raw: async () => [],
    };

    const bound: { params: unknown[] } = { params: [] };
    statement.bind = (...params: unknown[]) => {
      bound.params = params;
      return statement;
    };
    statement.first = async <T = unknown>(): Promise<T | null> => {
      const rows = await d1.runSelect(sql, bound.params);
      return (rows[0] as T) ?? null;
    };
    statement.all = async <T = unknown>(): Promise<{ results: T[]; meta: Record<string, unknown> }> => {
      const rows = await d1.runSelect(sql, bound.params);
      return { results: rows as T[], meta: {} };
    };
    statement.run = async () => {
      const changes = await d1.runWrite(sql, bound.params);
      return { success: true, meta: { changes } };
    };

    return statement;
  }

  private async runSelect(sql: string, params: unknown[]): Promise<Row[]> {
    for (const { pattern, handler } of this.handlers) {
      if (sql.includes(pattern)) {
        const result = await handler(params);
        if (result === undefined) {
          return [];
        }
        return Array.isArray(result) ? (result as Row[]) : [result as Row];
      }
    }

    const table = this.tables[extractTable(sql)];
    if (!table) {
      return [];
    }

    let rows = table;

    const join = parseJoin(sql);
    if (join) {
      const joinedTable = this.tables[join.table];
      if (joinedTable) {
        const leftCol = joinColumn(join.onLeft);
        const rightCol = joinColumn(join.onRight);
        rows = rows.flatMap((row) => {
          const matches = joinedTable.filter(
            (joined) => row[leftCol] === joined[rightCol] || row[rightCol] === joined[leftCol]
          );
          if (matches.length === 0) {
            return [row];
          }
          return matches.map((joined) => ({ ...joined, ...row }));
        });
      }
    }

    const where = parseWhere(sql, params);
    if (where.length > 0) {
      rows = rows.filter((row) => where.every((clause) => rowMatches(row, clause)));
    }

    const orderBy = parseOrderBy(sql);
    if (orderBy) {
      rows = [...rows].sort((a, b) => {
        const av = String(a[orderBy!.column] ?? "");
        const bv = String(b[orderBy!.column] ?? "");
        return orderBy!.desc ? bv.localeCompare(av) : av.localeCompare(bv);
      });
    }

    const limit = parseLimit(sql, params);
    if (limit !== null) {
      rows = rows.slice(0, limit);
    }

    return rows;
  }

  private async runWrite(sql: string, params: unknown[]): Promise<number> {
    const insertMatch = sql.match(/INSERT INTO\s+([A-Za-z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      const columns = insertMatch[2].split(",").map((c) => c.trim());
      const rawValues = insertMatch[3].split(",").map((v) => v.trim());
      const table = this.tables[tableName] ?? (this.tables[tableName] = []);
      const row: Row = {};
      columns.forEach((column, index) => {
        const raw = rawValues[index] ?? "";
        const placeholder = raw.match(PLACEHOLDER);
        row[column] = placeholder
          ? params[Number(placeholder[1]) - 1]
          : raw.replace(/^'|'$/g, "");
      });
      table.push(row);
      return 1;
    }

    const deleteMatch = sql.match(/DELETE FROM\s+([A-Za-z0-9_]+)\s+WHERE\s+(.+)$/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      const table = this.tables[tableName];
      if (!table) {
        return 0;
      }
      const where: WhereClause[] = parseWhere(`WHERE ${deleteMatch[2]}`, params);
      const before = table.length;
      for (let i = table.length - 1; i >= 0; i--) {
        if (where.every((clause) => rowMatches(table[i], clause))) {
          table.splice(i, 1);
        }
      }
      return before - table.length;
    }

    const updateMatch = sql.match(/UPDATE\s+([A-Za-z0-9_]+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
    if (updateMatch) {
      const tableName = updateMatch[1];
      const setClause = updateMatch[2];
      const table = this.tables[tableName];
      if (!table) {
        return;
      }      const setCols = setClause.split(",").map((part) => {
        const eq = part.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/);
        if (!eq) {
          return null;
        }
        const placeholder = eq[2].match(PLACEHOLDER);
        return {
          column: eq[1],
          value: placeholder ? params[Number(placeholder[1]) - 1] : eq[2].replace(/^'|'$/g, ""),
        };
      });
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+LIMIT|$)/i);
      const where: WhereClause[] = whereMatch ? parseWhere("WHERE " + whereMatch[1], params) : [];
      let matched = 0;
      for (const row of table) {
        if (where.every((clause) => rowMatches(row, clause))) {
          for (const set of setCols) {
            if (set) {
              row[set.column] = set.value;
            }
          }
          matched++;
        }
      }
      return matched;
    }

    throw new Error(`Unsupported write SQL: ${sql}`);
  }

  async batch(): Promise<unknown[]> {
    return [];
  }

  async exec(): Promise<D1Result> {
    return { success: true, meta: {} };
  }

  async withSession(): Promise<unknown> {
    throw new Error("withSession is not supported by FakeD1");
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}
