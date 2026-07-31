"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

const agents = [
  { id: "agent-1", name: "Data Analyzer", type: "analysis", status: "active", project: "Market Research", executions: 1247, successRate: 96.2 },
  { id: "agent-2", name: "Code Reviewer", type: "coding", status: "active", project: "SDK Development", executions: 892, successRate: 98.1 },
  { id: "agent-3", name: "Test Generator", type: "testing", status: "idle", project: "QA Automation", executions: 456, successRate: 94.5 },
];

export default function ResearchPage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Research Agents</h2>
          <p className="text-[#475569]">Manage your autonomous AI research agents.</p>
        </div>
        <button className="px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors">
          Create Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A]">{agent.name}</h3>
                <p className="text-sm text-[#94A3B8]">{agent.project}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                agent.status === "active" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#94A3B8]/10 text-[#94A3B8]"
              }`}>
                {agent.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E2E8F0]">
              <div>
                <p className="text-xs text-[#94A3B8] mb-1">Executions</p>
                <p className="text-lg font-semibold text-[#0F172A]">{agent.executions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#94A3B8] mb-1">Success Rate</p>
                <p className="text-lg font-semibold text-[#10B981]">{agent.successRate}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
