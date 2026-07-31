"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchExecutions, type Execution, type ExecutionListResponse } from "@/lib/api";

export function useExecutions(params?: {
  project_id?: string;
  status?: string;
  limit?: number;
}) {
  const [data, setData] = useState<ExecutionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchExecutions(params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch executions");
    } finally {
      setLoading(false);
    }
  }, [params?.project_id, params?.status, params?.limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}

export function useDashboardStats() {
  const [stats, setStats] = useState({
    total_executions: 0,
    total_tokens: 0,
    total_cost: 0,
    success_rate: 0,
    avg_latency_ms: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchExecutions({ limit: 100 });
        const executions = result.data;

        const totalTokens = executions.reduce((sum, e) => sum + (e.total_tokens || 0), 0);
        const totalCost = executions.reduce((sum, e) => sum + (e.estimated_cost || 0), 0);
        const completed = executions.filter((e) => e.status === "completed").length;
        const totalLatency = executions.reduce((sum, e) => sum + (e.latency_ms || 0), 0);

        setStats({
          total_executions: executions.length,
          total_tokens: totalTokens,
          total_cost: totalCost,
          success_rate: executions.length > 0 ? (completed / executions.length) * 100 : 0,
          avg_latency_ms: executions.length > 0 ? totalLatency / executions.length : 0,
        });
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { stats, loading };
}
