"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://stratscope-api.khalidkhan.workers.dev";

export interface Execution {
  id: string;
  organization_id: string;
  project_id: string;
  agent_id: string | null;
  status: string;
  model: string | null;
  provider: string | null;
  trace_id: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  input: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ExecutionListResponse {
  data: Execution[];
  pagination: {
    cursor: string | null;
    has_more: boolean;
    limit: number;
  };
}

export interface DashboardStats {
  total_executions: number;
  total_tokens: number;
  total_cost: number;
  success_rate: number;
  avg_latency_ms: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Agent {
  id: string;
  project_id: string;
  name: string;
  framework: string | null;
  status: string;
  created_at: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchExecutions(params?: {
  project_id?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<ExecutionListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.project_id) searchParams.set("project_id", params.project_id);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);

  const query = searchParams.toString();
  return apiRequest<ExecutionListResponse>(`/v1/executions${query ? `?${query}` : ""}`);
}

export async function fetchExecution(id: string): Promise<Execution> {
  return apiRequest<Execution>(`/v1/executions/${id}`);
}

export async function createExecution(data: {
  project_id: string;
  input: string;
  model?: string;
  provider?: string;
}): Promise<{ id: string; trace_id: string; status: string }> {
  return apiRequest("/v1/executions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchProjects(): Promise<Project[]> {
  return apiRequest<Project[]>("/v1/projects");
}

export async function fetchAgents(): Promise<Agent[]> {
  return apiRequest<Agent[]>("/v1/agents");
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const executions = await fetchExecutions({ limit: 1000 });
    const data = executions.data;
    const totalTokens = data.reduce((sum, e) => sum + (e.total_tokens || 0), 0);
    const totalCost = data.reduce((sum, e) => sum + (e.estimated_cost || 0), 0);
    const completed = data.filter((e) => e.status === "completed").length;
    const latencies = data.filter((e) => e.latency_ms).map((e) => e.latency_ms!);
    return {
      total_executions: executions.pagination.has_more ? data.length + 1000 : data.length,
      total_tokens: totalTokens,
      total_cost: totalCost,
      success_rate: data.length > 0 ? (completed / data.length) * 100 : 0,
      avg_latency_ms: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    };
  } catch {
    return {
      total_executions: 0,
      total_tokens: 0,
      total_cost: 0,
      success_rate: 0,
      avg_latency_ms: 0,
    };
  }
}