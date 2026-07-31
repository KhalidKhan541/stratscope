"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

const benchmarks = [
  { id: "bm-1", name: "Reasoning Depth Test", model: "groq/llama-3.3-70b", score: 94.2, runs: 1247, status: "passing" },
  { id: "bm-2", name: "Tool Selection Accuracy", model: "groq/mixtral-8x7b", score: 87.5, runs: 892, status: "passing" },
  { id: "bm-3", name: "Hallucination Detection", model: "groq/llama-3.3-70b", score: 98.1, runs: 2103, status: "passing" },
];

export default function BenchmarksPage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Benchmarks</h2>
          <p className="text-[#475569]">Compare models and track improvements over time.</p>
        </div>
        <button className="px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors">
          Run Benchmark
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {benchmarks.map((bm) => (
          <div key={bm.id} className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#0F172A]">{bm.name}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#10B981]/10 text-[#10B981]">
                {bm.status}
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] font-mono mb-4">{bm.model}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[#94A3B8] mb-1">Score</p>
                <p className="text-2xl font-bold text-[#0F172A]">{bm.score}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#94A3B8] mb-1">Total Runs</p>
                <p className="text-sm font-medium text-[#475569]">{bm.runs.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
