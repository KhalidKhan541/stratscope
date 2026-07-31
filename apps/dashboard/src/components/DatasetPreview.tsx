"use client";

import { useState } from "react";

const datasets = [
  {
    id: "failure",
    label: "Failure Datasets",
    description: "Structured records of agent exceptions, broken tool calls, and logic loops captured during execution.",
    code: `{
  "execution_id": "exec_8f2k9x",
  "failure_type": "tool_call_error",
  "agent": "ResearchAgent",
  "error": "Rate limit exceeded on web_search",
  "recovery_strategy": "exponential_backoff",
  "context": {
    "tool": "web_search",
    "attempts": 3,
    "success_on": 4
  }
}`,
  },
  {
    id: "reasoning",
    label: "Reasoning Datasets",
    description: "Step-by-step chain-of-thought execution trajectories normalized for model distillation.",
    code: `{
  "execution_id": "exec_3m7p2q",
  "agent": "CodeAnalyzer",
  "reasoning_steps": [
    {"step": 1, "action": "parse_ast", "confidence": 0.97},
    {"step": 2, "action": "identify_complexity", "confidence": 0.94},
    {"step": 3, "action": "suggest_refactor", "confidence": 0.91}
  ],
  "total_tokens": 2103,
  "reasoning_depth": "deep"
}`,
  },
  {
    id: "routing",
    label: "Tool Selection & Routing",
    description: "Comparative evaluation metrics across model providers including Groq, Anthropic, and OpenAI.",
    code: `{
  "execution_id": "exec_9k4n1w",
  "routing_decision": {
    "selected_model": "groq/llama-3.3-70b",
    "alternatives": ["openai/gpt-4o", "anthropic/claude-3.5"],
    "selection_reason": "latency_optimized"
  },
  "metrics": {
    "latency_ms": 312,
    "tokens_per_ms": 10.4,
    "cost_efficiency": 0.89
  }
}`,
  },
  {
    id: "coding",
    label: "Coding & Planning",
    description: "Execution logs from coding and planning agents operating on the StratScope SDK.",
    code: `{
  "execution_id": "exec_5t8w2r",
  "agent": "PlanningAgent",
  "task": "Implement authentication middleware",
  "plan": [
    "Analyze existing auth patterns",
    "Design middleware interface",
    "Implement Clerk integration",
    "Write unit tests"
  ],
  "completion_rate": 0.92,
  "artifacts_generated": 4
}`,
  },
];

export function DatasetPreview() {
  const [activeTab, setActiveTab] = useState("failure");
  const activeDataset = datasets.find((d) => d.id === activeTab)!;

  return (
    <section id="datasets" className="py-24 px-6 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold text-[#4F46E5] bg-[#4F46E5]/10 px-3 py-1 rounded-full mb-4">
            RESEARCH DATASETS
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
            Automated Research Datasets
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            Exportable in Parquet, JSONL, and Apache Arrow. Built automatically from execution history.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#E2E8F0] overflow-x-auto">
            {datasets.map((dataset) => (
              <button
                key={dataset.id}
                onClick={() => setActiveTab(dataset.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === dataset.id
                    ? "text-[#4F46E5] border-b-2 border-[#4F46E5]"
                    : "text-[#94A3B8] hover:text-[#475569]"
                }`}
              >
                {dataset.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-[#475569] mb-4">{activeDataset.description}</p>
            <div className="bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-[#0F172A] whitespace-pre">{activeDataset.code}</pre>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Sample
              </button>
              <button className="px-4 py-2 text-sm font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors">
                View Export Docs
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
