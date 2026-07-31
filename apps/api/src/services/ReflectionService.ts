/**
 * Reflection business logic interface.
 *
 * Defines the contract for reflection-related operations.
 * Reflections analyze execution outcomes and generate insights.
 */

export interface ReflectionRecord {
  readonly id: string;
  readonly execution_id: string;
  readonly summary: string | null;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly recommendations: readonly string[];
  readonly confidence: number | null;
  readonly reflection_model: string | null;
  readonly reasoning: string | null;
  readonly created_at: string;
}

export interface ReflectionListFilters {
  readonly executionId?: string;
  readonly organizationId?: string;
}

export interface PaginationParams {
  readonly cursor?: string;
  readonly limit: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface GenerateReflectionRequest {
  readonly executionId: string;
  readonly model?: string;
}

/**
 * Service interface for reflection operations.
 */
export interface ReflectionService {
  /**
   * Lists reflections with filtering and pagination.
   */
  listReflections(
    filters: ReflectionListFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<ReflectionRecord>>;

  /**
   * Retrieves a reflection by ID.
   */
  getReflectionById(id: string): Promise<ReflectionRecord | null>;

  /**
   * Generates a reflection for an execution.
   *
   * Uses the execution's input/output and evaluation to produce
   * a structured reflection with strengths, weaknesses, and recommendations.
   */
  generateReflection(request: GenerateReflectionRequest): Promise<ReflectionRecord>;
}
