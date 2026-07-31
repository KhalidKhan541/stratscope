"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useExecutions } from "@/lib/hooks";

export default function ExecutionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { executions, loading, error } = useExecutions({ status: statusFilter || undefined, limit: 50 });

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Executions</h2>
        <p className="text-[#475569]">Browse and analyze all AI execution traces.</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Execution ID</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Model</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Tokens</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Latency</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Cost</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-[#F1F5F9] rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="text-4xl mb-4">⚡</div>
                    <h3 className="text-lg font-semibold text-[#0F172A] mb-2">No executions yet</h3>
                    <p className="text-sm text-[#475569]">Connect your AI agent with the StratScope SDK to see executions here.</p>
                  </td>
                </tr>
              ) : (
                executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-[#0F172A]">{exec.id}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        exec.status === "completed" ? "bg-[#10B981]/10 text-[#10B981]" :
                        exec.status === "failed" ? "bg-[#EF4444]/10 text-[#EF4444]" :
                        "bg-[#F59E0B]/10 text-[#F59E0B]"
                      }`}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#475569]">{exec.model || "—"}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[#475569]">{exec.total_tokens?.toLocaleString() || "—"}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[#475569]">{exec.latency_ms ? `${exec.latency_ms}ms` : "—"}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[#475569]">{exec.estimated_cost ? `$${exec.estimated_cost.toFixed(4)}` : "—"}</td>
                    <td className="px-6 py-4 text-sm text-[#94A3B8]">{new Date(exec.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
