"use client";

import { useState } from "react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";

const categories = [
  {
    id: "failures",
    icon: "🐛",
    title: "Failure & Recovery Datasets",
    desc: "Real agent failures, error patterns, debugging traces, and recovery strategies from production systems.",
    color: "#DC2626",
    count: "234",
    executions: "420K+",
    datasets: [
      { name: "coding_bug_fixes_v12", size: "87K traces", buyers: 23, price: "$0.12/trace" },
      { name: "browser_navigation_errors_v8", size: "134K traces", buyers: 18, price: "$0.09/trace" },
      { name: "api_error_recovery_v5", size: "56K traces", buyers: 31, price: "$0.15/trace" },
      { name: "multi_agent_deadlock_v3", size: "42K traces", buyers: 12, price: "$0.22/trace" },
      { name: "token_limit_exceeded_v7", size: "67K traces", buyers: 25, price: "$0.11/trace" },
      { name: "hallucination_detection_v9", size: "98K traces", buyers: 41, price: "$0.18/trace" },
    ]
  },
  {
    id: "reasoning",
    icon: "🧠",
    title: "Reasoning & Decision Traces",
    desc: "Multi-step planning, tool selection, decision paths, and reasoning patterns from capable agents.",
    color: "#7C3AED",
    count: "189",
    executions: "612K+",
    datasets: [
      { name: "seea_planning_traces_v11", size: "156K traces", buyers: 34, price: "$0.14/trace" },
      { name: "chain_of_thought_coding_v6", size: "203K traces", buyers: 28, price: "$0.11/trace" },
      { name: "tool_selection_patterns_v4", size: "89K traces", buyers: 19, price: "$0.13/trace" },
      { name: "recursive_reasoning_v5", size: "67K traces", buyers: 15, price: "$0.19/trace" },
    ]
  },
  {
    id: "multi_agent",
    icon: "🔄",
    title: "Multi-Agent Interactions",
    desc: "Coordination protocols, delegation strategies, communication patterns, and conflict resolution between agents.",
    color: "#2563EB",
    count: "156",
    executions: "287K+",
    datasets: [
      { name: "agent_handoff_patterns_v3", size: "67K traces", buyers: 22, price: "$0.16/trace" },
      { name: "consensus_mechanisms_v2", size: "45K traces", buyers: 14, price: "$0.21/trace" },
      { name: "delegation_strategies_v4", size: "89K traces", buyers: 18, price: "$0.15/trace" },
      { name: "conflict_resolution_v1", size: "34K traces", buyers: 11, price: "$0.25/trace" },
    ]
  },
  {
    id: "metrics",
    icon: "⚡",
    title: "Execution Metrics & Analytics",
    desc: "Latency, cost, token usage, success rates, model comparisons across tasks and agent architectures.",
    color: "#D97706",
    count: "312",
    executions: "1.8M+",
    datasets: [
      { name: "model_cost_latency_v15", size: "450K traces", buyers: 56, price: "$0.08/trace" },
      { name: "token_usage_patterns_v9", size: "312K traces", buyers: 38, price: "$0.10/trace" },
      { name: "success_rate_by_task_v7", size: "278K traces", buyers: 42, price: "$0.12/trace" },
      { name: "agent_architecture_comparison_v4", size: "189K traces", buyers: 27, price: "$0.17/trace" },
    ]
  },
];

const buyerStats = [
  { stat: "340+", label: "AI Companies Buying" },
  { stat: "$2.4M", label: "Paid to Agent Owners" },
  { stat: "94%", label: "Dataset Quality Score" },
  { stat: "4.2h", label: "Avg Time to First Sale" },
];

export default function DatasetsPage() {
  const [activeCat, setActiveCat] = useState("failures");
  const cat = categories.find((c) => c.id === activeCat)!;

  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <a href="/" className="hover:text-slate-900">Home</a><span>/</span><span className="text-slate-900">Datasets</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Execution Datasets Marketplace</h1>
              <p className="text-lg text-slate-600 mb-2">Real execution data from 12,000+ registered agents. Not synthetic. Not simulated.</p>
              <p className="text-slate-500">Every dataset is generated from actual agent executions — tool calls, decisions, errors, recoveries. Filter by agent type, task category, quality score, and buyer demand.</p>
            </div>
            <div className="bg-slate-900 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-slate-500 text-xs font-mono">marketplace_stats</span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                {buyerStats.map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-bold text-white">{s.stat}</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-6">Dataset Categories</h2>
          <div className="flex flex-wrap gap-3 mb-8">
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${activeCat === c.id ? `bg-blue-600 text-white border-blue-600` : "bg-white text-slate-600 border-slate-200 hover:border-blue-200"}`}>
                <span>{c.icon}</span>{c.title}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${cat.color}10` }}>{cat.icon}</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{cat.title}</h3>
                  <p className="text-slate-500">{cat.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Datasets</p>
                <p className="font-semibold text-slate-900">{cat.count}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-3 font-medium">Dataset Name</th>
                    <th className="pb-3 font-medium">Size</th>
                    <th className="pb-3 font-medium">Active Buyers</th>
                    <th className="pb-3 font-medium">Price/Trace</th>
                    <th className="pb-3 font-medium">Revenue Potential</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.datasets.map((d) => (
                    <tr key={d.name} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="py-4 font-medium text-slate-900 font-mono">{d.name}</td>
                      <td className="py-4 text-slate-600">{d.size}</td>
                      <td className="py-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{d.buyers}</span>
                      </td>
                      <td className="py-4 font-semibold text-slate-900">{d.price}</td>
                      <td className="py-4 text-green-600 font-medium">${(parseFloat(d.price.replace("$","")) * parseInt(d.size.replace("K","").replace(" traces","")) * 1000 / 100).toLocaleString()}/mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            {categories.filter((c) => c.id !== activeCat).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer" onClick={() => setActiveCat(c.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{c.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-900">{c.title}</div>
                    <div className="text-sm text-slate-500">{c.count} datasets • {c.executions} executions</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Buy Execution Datasets</h2>
          <p className="text-slate-600 mb-8">Access the largest corpus of real agent execution data. Instant delivery via API or download.</p>
          <div className="flex justify-center gap-4">
            <a href="/sign-up" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">Browse Marketplace →</a>
            <a href="/pricing" className="border border-slate-300 text-slate-700 font-semibold px-8 py-3 rounded-lg hover:bg-white transition-colors">View Pricing</a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}