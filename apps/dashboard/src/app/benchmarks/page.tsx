"use client";

import { MarketingLayout } from "@/components/layout/MarketingLayout";

const benchmarks = [
  {
    id: "coding",
    icon: "</>",
    title: "Coding Agent Benchmarks",
    desc: "Evaluate code generation, bug fixing, refactoring, and test writing against real execution traces.",
    color: "#2563EB",
    datasets: "189",
    executions: "612K+",
    metrics: ["Pass@1 / Pass@k", "Test coverage", "Code quality score", "Security issues", "Style compliance", "Runtime efficiency"],
    tasks: ["HumanEval+ (extended)", "MBPP Pro", "SWE-Bench Verified", "BigCodeBench", "CodeXGLUE Extended", "Repo-Level Tasks"],
    buyers: "42 companies evaluating coding agents",
  },
  {
    id: "browser",
    icon: "🌐",
    title: "Browser Agent Benchmarks",
    desc: "Measure navigation, form filling, data extraction, and error recovery on real websites.",
    color: "#059669",
    datasets: "134",
    executions: "890K+",
    metrics: ["Task success rate", "Steps to completion", "Error recovery rate", "Stealth score", "Latency per action", "Cross-site consistency"],
    tasks: ["WebArena Full", "Mind2Web Hard", "MiniWob++ Complete", "VisualWebArena", "AgentTrek", "Real E-commerce Flows"],
    buyers: "28 companies evaluating browser agents",
  },
  {
    id: "reasoning",
    icon: "🧠",
    title: "Reasoning & Planning Benchmarks",
    desc: "Test multi-step planning, tool use, recursive reasoning, and decision quality.",
    color: "#7C3AED",
    datasets: "112",
    executions: "340K+",
    metrics: ["Planning accuracy", "Tool selection F1", "Reasoning depth", "Error detection", "Correction quality", "Hallucination rate"],
    tasks: ["PlanBench", "ToolBench", "ReAct Eval", "Recursive Tasks", "Multi-hop QA", "AgentBench Reasoning"],
    buyers: "35 companies evaluating reasoning agents",
  },
  {
    id: "multi_agent",
    icon: "🔄",
    title: "Multi-Agent Benchmarks",
    desc: "Evaluate coordination, delegation, consensus, and conflict resolution between agents.",
    color: "#D97706",
    datasets: "87",
    executions: "156K+",
    metrics: ["Coordination efficiency", "Delegation accuracy", "Consensus time", "Conflict resolution", "Communication overhead", "Collective IQ"],
    tasks: ["MA-Bench", "CoordinationBench", "DelegationEval", "ConsensusTasks", "CAMEL Tasks", "MetaGPT Scenarios"],
    buyers: "19 companies evaluating multi-agent systems",
  },
];

const runBenchmark = `import { StratScopeBenchmark } from '@stratscope/sdk';

const benchmark = new StratScopeBenchmark({
  apiKey: process.env.STRATSCOPE_API_KEY,
  agentId: 'agent_mycoding_01'
});

// Run SWE-Bench Verified against execution traces
const results = await benchmark.run({
  benchmark: 'swe-bench-verified',
  dataset: 'seea_planning_traces_v11',
  metrics: ['pass_at_1', 'test_coverage', 'code_quality'],
  compareAgainst: ['gpt-4', 'claude-3-opus', 'seea']
});

console.log(results);
/*
{
  agent: 'agent_mycoding_01',
  pass_at_1: 0.73,
  test_coverage: 0.89,
  code_quality: 8.2,
  percentile: 87,
  compared_to: {
    'gpt-4': { pass_at_1: 0.68 },
    'claude-3-opus': { pass_at_1: 0.71 },
    'seea': { pass_at_1: 0.82 }
  }
}
*/`;

export default function BenchmarksPage() {
  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">BENCHMARKS</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Execution-Based Benchmarks</h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              Traditional benchmarks use static test cases. Ours use real execution traces from production agents.
              Evaluate your agent against how agents actually behave in the wild.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              {[
                { stat: "522", label: "Active Benchmarks" },
                { stat: "2M+", label: "Execution Traces" },
                { stat: "124", label: "AI Companies Evaluating" },
                { stat: "99.2%", label: "Trace Coverage" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-3xl font-bold text-blue-600">{s.stat}</div>
                  <div className="text-sm text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {benchmarks.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg transition-all cursor-pointer">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: `${b.color}10` }}>{b.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{b.title}</h3>
                    <p className="text-sm text-slate-500">{b.datasets} datasets • {b.executions} executions</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm mb-6">{b.desc}</p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Key Metrics</span>
                    <span className="font-semibold" style={{ color: b.color }}>{b.metrics.length} tracked</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Benchmark Tasks</span>
                    <span className="font-semibold" style={{ color: b.color }}>{b.tasks.length} available</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">{b.buyers}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Run Benchmarks Against Real Traces</h2>
            <p className="text-slate-400">Compare your agent against execution data from production agents — not synthetic test cases.</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-slate-400 text-sm font-mono">benchmark_run.py</span>
            </div>
            <pre className="text-green-400 font-mono text-sm overflow-x-auto leading-relaxed">
              <code>{runBenchmark}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Available Benchmark Tasks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "HumanEval+ Extended", cat: "Coding", traces: "156K", status: "Live" },
              { name: "SWE-Bench Verified", cat: "Coding", traces: "89K", status: "Live" },
              { name: "WebArena Full", cat: "Browser", traces: "234K", status: "Live" },
              { name: "Mind2Web Hard", cat: "Browser", traces: "167K", status: "Live" },
              { name: "PlanBench", cat: "Reasoning", traces: "89K", status: "Beta" },
              { name: "ToolBench Complete", cat: "Reasoning", traces: "112K", status: "Live" },
              { name: "MA-Bench", cat: "Multi-Agent", traces: "67K", status: "Beta" },
              { name: "CoordinationBench", cat: "Multi-Agent", traces: "45K", status: "Beta" },
            ].map((t) => (
              <div key={t.name} className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-300 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-blue-600">{t.cat}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.status === "Live" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{t.status}</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{t.name}</h3>
                <p className="text-sm text-slate-500">{t.traces} execution traces</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Start Benchmarking Today</h2>
          <p className="text-slate-600 mb-8">Run your agent against the most realistic benchmarks available. Get detailed comparison reports.</p>
          <a href="/sign-up" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">Run Free Benchmark →</a>
        </div>
      </section>
    </MarketingLayout>
  );
}