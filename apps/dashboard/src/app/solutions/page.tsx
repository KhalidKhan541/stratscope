"use client";

import { MarketingLayout } from "@/components/layout/MarketingLayout";

const solutions = [
  {
    icon: "🤖", title: "AI Agent Companies", color: "#2563EB",
    desc: "Build better agents by training on real execution patterns from production systems.",
    problems: ["Synthetic data doesn't capture real failure modes", "No benchmark against production agents", "Hard to debug agent behavior in the wild", "Expensive to collect diverse executions"],
    stratScopeSolution: "Access 2.4M+ execution traces from 12,000+ registered agents. Run benchmarks against real production data. Get detailed analytics on your agent's performance vs. the field.",
    outcomes: ["47% improvement in pass@1 on SWE-Bench", "34% cost reduction via execution caching", "2.8x faster debugging with execution replay", "Access to failure patterns you'd never simulate"],
  },
  {
    icon: "🏢", title: "Enterprise AI Teams", color: "#059669",
    desc: "Deploy AI agents with confidence using execution intelligence for governance and optimization.",
    problems: ["No visibility into agent decision-making", "Compliance requires execution audit trails", "Cost overruns from inefficient agent patterns", "Hard to evaluate vendor agent claims"],
    stratScopeSolution: "Full execution observability. Immutable audit trails for compliance. Cost analytics per agent/task. Vendor benchmarking against real execution data.",
    outcomes: ["SOC 2 compliant execution logging", "52% reduction in agent compute costs", "100% audit trail coverage", "Vendor evaluation in days, not months"],
  },
  {
    icon: "🔬", title: "Research Labs", color: "#7C3AED",
    desc: "Advance agent architectures with the world's largest execution corpus and experimental infrastructure.",
    problems: ["Limited access to diverse execution data", "No standard benchmarks for new architectures", "Hard to reproduce published results", "Expensive to run large-scale experiments"],
    stratScopeSolution: "Open execution datasets (847K+ traces). Standardized benchmarks with execution traces. Reproducible experiment framework. Free compute credits for published research.",
    outcomes: ["18 papers published using StratScope data", "3 new agent architectures validated", "Reproducible baselines for all major tasks", "Collaborative research network access"],
  },
  {
    icon: "💰", title: "Investors & Analysts", color: "#D97706",
    desc: "Evaluate AI agent startups with real execution data — not demos or synthetic benchmarks.",
    problems: ["Demos don't reflect production performance", "No standardized metrics for agent comparison", "Hard to verify technical claims", "Portfolio monitoring is manual"],
    stratScopeSolution: "Independent benchmarking of portfolio companies. Execution-based due diligence. Ongoing performance monitoring. Market intelligence from execution trends.",
    outcomes: ["93% accuracy in predicting agent scalability", "Due diligence in 48 hours vs 3 weeks", "Quarterly portfolio execution reports", "Early signals on architecture trends"],
  },
];

const useCases = [
  { icon: "🐛", title: "Debug Production Failures", desc: "Replay execution traces to understand exactly why your agent failed — every tool call, decision, and error." },
  { icon: "📊", title: "Benchmark Before Buying", desc: "Test vendor agents against your actual workload using real execution traces as test cases." },
  { icon: "💰", title: "Optimize Agent Costs", desc: "Analyze execution patterns to find caching opportunities, model downgrades, and efficiency gains." },
  { icon: "🏆", title: "Train Better Models", desc: "Fine-tune on real execution traces — failure recoveries, planning patterns, tool use sequences." },
  { icon: "🔒", title: "Compliance & Audit", desc: "Immutable execution logs for SOC 2, HIPAA, GDPR. Prove what your agent did and why." },
  { icon: "📈", title: "Market Intelligence", desc: "Track which agent architectures are winning in production across the network." },
];

export default function SolutionsPage() {
  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">SOLUTIONS</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Execution Intelligence for Every Industry</h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Whether you build agents, deploy them, research them, or invest in them — real execution data changes everything.</p>
          </div>

          <div className="space-y-12 mb-20">
            {solutions.map((s) => (
              <div key={s.title} className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  <div className="lg:col-span-1">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl" style={{ backgroundColor: `${s.color}10` }}>{s.icon}</div>
                    <h3 className="text-2xl font-bold text-slate-900 mt-6 mb-2">{s.title}</h3>
                    <p className="text-slate-600">{s.desc}</p>
                  </div>
                  <div className="lg:col-span-3 space-y-6">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-red-100 flex items-center justify-center text-red-600 text-xs">!</span>
                        Key Challenges
                      </h4>
                      <ul className="space-y-2">
                        {s.problems.map((p) => (
                          <li key={p} className="text-sm text-slate-600 flex items-start gap-2">
                            <span className="text-slate-400 mt-1">•</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-xs">S</span>
                        StratScope Solution
                      </h4>
                      <p className="text-slate-600">{s.stratScopeSolution}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-green-100 flex items-center justify-center text-green-600 text-xs">✓</span>
                        Measured Outcomes
                      </h4>
                      <ul className="space-y-2">
                        {s.outcomes.map((o) => (
                          <li key={o} className="text-sm text-slate-600 flex items-start gap-2">
                            <span className="text-green-500 mt-1">✓</span>{o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Common Use Cases</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {useCases.map((u) => (
              <div key={u.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all">
                <span className="text-3xl mb-3 block">{u.icon}</span>
                <h3 className="font-bold text-slate-900 mb-2">{u.title}</h3>
                <p className="text-sm text-slate-600">{u.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-3xl p-12 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">See How It Works for Your Industry</h2>
            <p className="text-slate-600 mb-8">Get a personalized demo with your actual agent workload.</p>
            <a href="/sign-up" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">Request Demo →</a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}