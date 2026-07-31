import type { D1Database } from "@cloudflare/workers-types";

export interface AnonymizationPolicy {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly description: string;
  readonly methods: Record<string, string>;
  readonly fields: readonly string[];
  readonly default_method: string;
  readonly params: Record<string, unknown>;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface AnonymizationPolicyRow {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly description: string;
  readonly methods: string;
  readonly fields: string;
  readonly default_method: string;
  readonly params: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface IAnonymizationPolicyRepository {
  create(policy: AnonymizationPolicy): Promise<void>;
  findById(id: string): Promise<AnonymizationPolicy | null>;
  findByOrganizationId(orgId: string): Promise<readonly AnonymizationPolicy[]>;
}

export class D1AnonymizationPolicyRepository implements IAnonymizationPolicyRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "anonymization_policies") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(policy: AnonymizationPolicy): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          organization_id,
          name,
          description,
          methods,
          fields,
          default_method,
          params,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        policy.id,
        policy.organization_id,
        policy.name,
        policy.description,
        JSON.stringify(policy.methods),
        JSON.stringify(policy.fields),
        policy.default_method,
        JSON.stringify(policy.params),
        policy.status,
        policy.created_at,
        policy.updated_at
      )
      .run();
  }

  async findById(id: string): Promise<AnonymizationPolicy | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<AnonymizationPolicyRow>();

    return result ? this.rowToAnonymizationPolicy(result) : null;
  }

  async findByOrganizationId(orgId: string): Promise<readonly AnonymizationPolicy[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE organization_id = ?
         ORDER BY created_at DESC`
      )
      .bind(orgId)
      .all<AnonymizationPolicyRow>();

    return Object.freeze(result.results.map((row) => this.rowToAnonymizationPolicy(row)));
  }

  private rowToAnonymizationPolicy(row: AnonymizationPolicyRow): AnonymizationPolicy {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      description: row.description,
      methods: JSON.parse(row.methods) as Record<string, string>,
      fields: JSON.parse(row.fields) as readonly string[],
      default_method: row.default_method,
      params: JSON.parse(row.params) as Record<string, unknown>,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
