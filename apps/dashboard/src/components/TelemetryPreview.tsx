"use client";

import { useState, useEffect } from "react";

const executions = [
  {
    id: "exec_8f2k9x",
    agent: "ResearchAgent",
    model: "groq/llama-3.3-70b",
    status: "completed",
    latency: "234ms",
    tokens: 1847,
    cost: "$0.0023",
  },
  {
    id: "exec_3m7p2q",
    agent: "CodeAnalyzer",
    model: "groq/mixtral-8x7b",
    status: "completed",
    latency: "189ms",
    tokens: 2103,
    cost: "$0.0018",
  },
  {
    id: "exec_9k4n1w",
    agent: "PlanningAgent",
    model: "groq/llama-3.3-70b",
    status: "evaluated",
    latency: "312ms",
    tokens: 3241,
    cost: "$0.0041",
  },
];

const evaluationScores = [
  { metric: "Reasoning Depth", score: 94, color: "#10B981" },
  { metric: "Tool Selection", score: 87, color: "#4F46E5" },
  { metric: "Hallucination Rate", score: 2, color: "#10B981", inverse: true },
];

export function TelemetryPreview() {
  const [activeTab, setActiveTab] = useState<"traces" | "evaluate" | "export">("traces");
  const [currentExecution, setCurrentExecution] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setCurrentExecution((prev) => (prev + 1) % executions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAnimating]);

  const exec = executions[currentExecution];

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Glow effect behind the card */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5]/10 via-[#7C3AED]/10 to-[#4F46E5]/10 blur-3xl rounded-3xl" />

      <div className="relative bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC]">
          {(["traces", "evaluate", "export"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-[#4F46E5] border-b-2 border-[#4F46E5] bg-white"
                  : "text-[#94A3B8] hover:text-[#475569]"
              }`}
            >
              {tab === "traces" ? "Live Traces" : tab === "evaluate" ? "Evaluation" : "Export"}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="p-6 min-h-[320px]">
          {activeTab === "traces" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
                </span>
                <span className="text-xs font-medium text-[#475569]">Live execution stream</span>
              </div>

              {executions.map((e, i) => (
                <div
                  key={e.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                    i === currentExecution
                      ? "border-[#4F46E5]/30 bg-[#4F46E5]/5"
                      : "border-[#E2E8F0] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${e.status === "completed" ? "bg-[#10B981]" : "bg-[#4F46E5]"}`} />
                    <div>
                      <p className="text-sm font-medium text-[#0F172A] font-mono">{e.id}</p>
                      <p className="text-xs text-[#94A3B8]">{e.agent} &middot; {e.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#475569]">
                    <span className="font-mono">{e.latency}</span>
                    <span className="font-mono">{e.tokens} tokens</span>
                    <span className="font-mono text-[#10B981]">{e.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "evaluate" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-[#4F46E5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-[#0F172A]">Automated Quality Assessment</span>
              </div>

              {evaluationScores.map((item) => (
                <div key={item.metric} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#475569]">{item.metric}</span>
                    <span className="text-sm font-medium text-[#0F172A]">
                      {item.inverse ? `${item.score}%` : `${item.score}/100`}
                    </span>
                  </div>
                  <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.inverse ? 100 - item.score : item.score}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-[#4F46E5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="text-sm font-medium text-[#0F172A]">Export Datasets</span>
              </div>

              <div className="bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] p-4 font-mono text-xs">
                <p className="text-[#94A3B8]">// Sample JSONL output</p>
                <p className="text-[#0F172A]">{'{'}</p>
                <p className="text-[#0F172A] pl-4">"execution_id": "{exec.id}",</p>
                <p className="text-[#0F172A] pl-4">"agent": "{exec.agent}",</p>
                <p className="text-[#0F172A] pl-4">"model": "{exec.model}",</p>
                <p className="text-[#0F172A] pl-4">"metrics": {'{'}</p>
                <p className="text-[#0F172A] pl-8">"latency_ms": {exec.latency.replace("ms", "")},</p>
                <p className="text-[#0F172A] pl-8">"tokens": {exec.tokens},</p>
                <p className="text-[#0F172A] pl-8">"cost_usd": {exec.cost.replace("$", "")}</p>
                <p className="text-[#0F172A] pl-4">{'}'}</p>
                <p className="text-[#0F172A]">{'}'}</p>
              </div>

              <div className="flex gap-2">
                <button className="px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors">
                  Download JSONL
                </button>
                <button className="px-4 py-2 text-sm font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors">
                  View Parquet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
