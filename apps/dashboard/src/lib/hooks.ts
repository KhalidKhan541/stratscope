"use client";

import { useState, useEffect } from "react";
import {
  fetchExecutions,
  fetchDashboardStats,
  type Execution,
  type DashboardStats,
} from "./api";

export function useExecutions(params?: {
  project_id?: string;
  status?: string;
  limit?: number;
}) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetchExecutions(params);
        setExecutions(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [params?.project_id, params?.status, params?.limit]);

  return { executions, loading, error };
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
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
        const data = await fetchDashboardStats();
        setStats(data);
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
