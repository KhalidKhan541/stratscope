"use client";

import { useDashboardStats, useExecutions } from "@/lib/hooks";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const stats = [
  { label: "Total Executions", key: "total_executions", icon: "⚡", color: "#4F46E5" },
  { label: "Success Rate", key: "success_rate", icon: "✅", color: "#10B981", suffix: "%" },
  { label: "Total Tokens", key: "total_tokens", icon: "🔤", color: "#F59E0B" },
  { label: "Avg Latency", key: "avg_latency_ms", icon: "⏱️", color: "#EC4899", suffix: "ms" },
];

export default function DashboardPage() {
  const { stats: dashboardStats, loading } = useDashboardStats();
  const { executions } = useExecutions({ limit: 5 });

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Welcome back</h2>
        <p className="text-[#475569]">Here&apos;s what&apos;s happening with your AI executions today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.key} className="bg-white rounded-xl border border-[#E2E8F0] p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#475569]">{stat.label}</span>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-[#0F172A]">
              {loading ? (
                <div className="h-8 w-20 bg-[#F1F5F9] rounded animate-pulse" />
              ) : (
                <>
                  {typeof dashboardStats[stat.key as keyof typeof dashboardStats] === "number"
                    ? (dashboardStats[stat.key as keyof typeof dashboardStats] as number).toLocaleString()
                    : "0"}
                  {stat.suffix || ""}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Execution Volume</h3>
          <div className="h-48 flex items-end gap-2">
            {[65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 50, 70].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-[#4F46E5] rounded-t-sm transition-all hover:bg-[#4338CA]"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[10px] text-[#94A3B8]">{["J","F","M","A","M","J","J","A","S","O","N","D"][i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Token Usage</h3>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#4F46E5" strokeWidth="8" strokeDasharray="180 252" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="8" strokeDasharray="80 252" strokeDashoffset="-180" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="8" strokeDasharray="40 252" strokeDashoffset="-260" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#0F172A]">45%</div>
                  <div className="text-xs text-[#94A3B8]">Input</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#4F46E5]" />
              <span className="text-xs text-[#475569]">Input Tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981]" />
              <span className="text-xs text-[#475569]">Output Tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <span className="text-xs text-[#475569]">Cached</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0F172A]">Recent Executions</h3>
          <a href="/dashboard/executions" className="text-sm font-medium text-[#4F46E5] hover:text-[#4338CA] transition-colors">
            View All →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider pb-3">ID</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider pb-3">Status</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider pb-3">Model</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider pb-3">Tokens</th>
                <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider pb-3">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <p className="text-[#94A3B8]">No executions yet. Connect your SDK to start tracking.</p>
                  </td>
                </tr>
              ) : (
                executions.slice(0, 5).map((exec) => (
                  <tr key={exec.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 text-sm font-mono text-[#0F172A]">{exec.id}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        exec.status === "completed" ? "bg-[#10B981]/10 text-[#10B981]" :
                        exec.status === "failed" ? "bg-[#EF4444]/10 text-[#EF4444]" :
                        "bg-[#F59E0B]/10 text-[#F59E0B]"
                      }`}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-[#475569]">{exec.model || "—"}</td>
                    <td className="py-3 text-sm font-mono text-[#475569]">{exec.total_tokens?.toLocaleString() || "—"}</td>
                    <td className="py-3 text-sm font-mono text-[#475569]">{exec.latency_ms ? `${exec.latency_ms}ms` : "—"}</td>
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
