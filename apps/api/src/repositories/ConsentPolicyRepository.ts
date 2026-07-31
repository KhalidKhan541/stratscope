import type { D1Database } from "@cloudflare/workers-types";

export interface ConsentPolicy {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id: string;
  readonly scope: string;
  readonly allowed_use_cases: readonly string[];
  readonly retention_days: number;
  readonly requires_anonymization: boolean;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

interface ConsentPolicyRow {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id: string;
  readonly scope: string;
  readonly allowed_use_cases: string;
  readonly retention_days: number;
  readonly requires_anonymization: number;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface IConsentPolicyRepository {
  create(policy: ConsentPolicy): Promise<void>;
  findById(id: string): Promise<ConsentPolicy | null>;
  findByAgentId(agentId: string): Promise<readonly ConsentPolicy[]>;
  findByOrganizationId(orgId: string): Promise<readonly ConsentPolicy[]>;
  update(id: string, updates: Partial<ConsentPolicy>): Promise<void>;
  delete(id: string): Promise<void>;
}

export class D1ConsentPolicyRepository implements IConsentPolicyRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "consent_policies") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(policy: ConsentPolicy): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          organization_id,
          project_id,
          agent_id,
          scope,
          allowed_use_cases,
          retention_days,
          requires_anonymization,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        policy.id,
        policy.organization_id,
        policy.project_id,
        policy.agent_id,
        policy.scope,
        JSON.stringify(policy.allowed_use_cases),
        policy.retention_days,
        policy.requires_anonymization ? 1 : 0,
        policy.status,
        policy.created_at,
        policy.updated_at
      )
      .run();
  }

  async findById(id: string): Promise<ConsentPolicy | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(id)
      .first<ConsentPolicyRow>();

    return result ? this.rowToConsentPolicy(result) : null;
  }

  async findByAgentId(agentId: string): Promise<readonly ConsentPolicy[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE agent_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC`
      )
      .bind(agentId)
      .all<ConsentPolicyRow>();

    return Object.freeze(result.results.map((row) => this.rowToConsentPolicy(row)));
  }

  async findByOrganizationId(orgId: string): Promise<readonly ConsentPolicy[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE organization_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC`
      )
      .bind(orgId)
      .all<ConsentPolicyRow>();

    return Object.freeze(result.results.map((row) => this.rowToConsentPolicy(row)));
  }

  async update(id: string, updates: Partial<ConsentPolicy>): Promise<void> {
    const setClauses: string[] = [];
    const bindParams: unknown[] = [];

    if (updates.scope !== undefined) {
      setClauses.push("scope = ?");
      bindParams.push(updates.scope);
    }

    if (updates.allowed_use_cases !== undefined) {
      setClauses.push("allowed_use_cases = ?");
      bindParams.push(JSON.stringify(updates.allowed_use_cases));
    }

    if (updates.retention_days !== undefined) {
      setClauses.push("retention_days = ?");
      bindParams.push(updates.retention_days);
    }

    if (updates.requires_anonymization !== undefined) {
      setClauses.push("requires_anonymization = ?");
      bindParams.push(updates.requires_anonymization ? 1 : 0);
    }

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      bindParams.push(updates.status);
    }

    if (setClauses.length === 0) {
      return;
    }

    setClauses.push("updated_at = ?");
    bindParams.push(new Date().toISOString());

    bindParams.push(id);

    await this.db
      .prepare(
        `UPDATE ${this.tableName}
         SET ${setClauses.join(", ")}
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(...bindParams)
      .run();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName}
         SET deleted_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  private rowToConsentPolicy(row: ConsentPolicyRow): ConsentPolicy {
    return {
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      agent_id: row.agent_id,
      scope: row.scope,
      allowed_use_cases: JSON.parse(row.allowed_use_cases) as readonly string[],
      retention_days: row.retention_days,
      requires_anonymization: row.requires_anonymization === 1,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    };
  }
}
