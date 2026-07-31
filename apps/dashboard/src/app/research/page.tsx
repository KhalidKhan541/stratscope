"use client";

import { MarketingLayout } from "@/components/layout/MarketingLayout";

const papers = [
  {
    title: "How Production Coding Agents Fail: An Analysis of 847K Executions",
    authors: "K. Khan, S. Patel, M. Chen",
    venue: "StratScope Research, 2026",
    category: "Coding Agents",
    citations: 342,
    downloads: "12.4K",
    findings: [
      "42% of failures involve token limit issues, not logic errors",
      "Error recovery patterns are highly transferable across codebases",
      "Agents that plan before acting have 3.2x higher success rate",
      "Test-driven development patterns emerge spontaneously in top agents"
    ],
    tags: ["execution-analysis", "coding-agents", "failure-patterns"],
  },
  {
    title: "The Economics of Agent Execution: Cost, Latency, and Quality Trade-offs",
    authors: "R. Kim, J. Rodriguez, K. Khan",
    venue: "StratScope Research, 2026",
    category: "Execution Analytics",
    citations: 189,
    downloads: "8.7K",
    findings: [
      "GPT-4 class models: 73% of cost, 41% of executions",
      "Smaller models + execution-time tool use outperform single large model calls",
      "Optimal latency/cost ratio: 2.3s per execution for coding tasks",
      "Caching execution patterns reduces cost by 34% with 0.8% quality loss"
    ],
    tags: ["cost-optimization", "model-selection", "execution-economics"],
  },
  {
    title: "Multi-Agent Coordination Protocols in the Wild: 287K Interaction Traces",
    authors: "A. Gupta, S. Williams, K. Khan",
    venue: "StratScope Research, 2026",
    category: "Multi-Agent Systems",
    citations: 156,
    downloads: "6.2K",
    findings: [
      "Explicit delegation outperforms implicit coordination by 28%",
      "Conflict resolution via voting beats leader-based by 19%",
      "Communication overhead scales quadratically without protocol enforcement",
      "Emergent specialization occurs in 67% of long-running multi-agent tasks"
    ],
    tags: ["multi-agent", "coordination", "emergent-behavior"],
  },
  {
    title: "Browser Agents in Production: Stealth, Speed, and Success",
    authors: "L. Chen, M. Torres, K. Khan",
    venue: "StratScope Research, 2026",
    category: "Browser Agents",
    citations: 203,
    downloads: "9.1K",
    findings: [
      "Headless detection: 34% of sites block known automation signatures",
      "Human-like timing patterns reduce blocks by 78%",
      "Error recovery via visual verification succeeds 91% of the time",
      "Optimal action delay: 1.2-2.8s for undetected navigation"
    ],
    tags: ["browser-agents", "anti-bot", "web-automation"],
  },
];

const datasets = [
  { name: "seea_execution_corpus_v12", size: "847K traces", type: "Coding", access: "Open" },
  { name: "browser_agent_traces_v9", size: "1.2M traces", type: "Browser", access: "Open" },
  { name: "multi_agent_interactions_v4", size: "287K traces", type: "Multi-Agent", access: "Restricted" },
  { name: "reasoning_chains_v7", size: "612K traces", type: "Reasoning", access: "Open" },
  { name: "failure_recovery_patterns_v11", size: "420K traces", type: "Failures", access: "Open" },
  { name: "cost_latency_analysis_v15", size: "2.4M traces", type: "Analytics", access: "Open" },
];

const experiments = [
  { name: "Model Comparison: GPT-4 vs Claude-3 vs Llama-3", status: "Running", agents: 12, executions: "45K" },
  { name: "Agent Architecture Ablation Study", status: "Complete", agents: 8, executions: "180K" },
  { name: "Prompt Optimization via Execution Feedback", status: "Running", agents: 15, executions: "67K" },
  { name: "Cross-Domain Transfer: Coding → Browser", status: "Planned", agents: 6, executions: "—" },
];

export default function ResearchPage() {
  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">RESEARCH</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Execution Intelligence Research</h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Insights from millions of anonymized agent executions. The world's largest execution corpus powering AI research.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              { stat: "2.4M+", label: "Executions in Corpus" },
              { stat: "18", label: "Published Papers" },
              { stat: "847K", label: "Open Access Traces" },
              { stat: "124", label: "Research Partners" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-2xl p-8 text-center">
                <div className="text-4xl font-bold text-blue-600">{s.stat}</div>
                <div className="text-sm text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-8">Published Research</h2>
          <div className="space-y-6 mb-16">
            {papers.map((p) => (
              <div key={p.title} className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg transition-all">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-blue-600">{p.category}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-sm text-slate-500">{p.venue}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{p.title}</h3>
                    <p className="text-sm text-slate-500 mb-4">By {p.authors}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {p.tags.map((t) => (
                        <span key={t} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{t}</span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {p.findings.map((f) => (
                        <div key={f} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-blue-600 mt-1">→</span>{f}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-center pt-8 lg:pt-0 border-l border-slate-200 lg:border-l lg:border-t-0 lg:border-b-0 lg:pl-8">
                    <div className="text-2xl font-bold text-slate-900">{p.citations}</div>
                    <div className="text-sm text-slate-500">Citations</div>
                    <div className="text-2xl font-bold text-slate-900 mt-4">{p.downloads}</div>
                    <div className="text-sm text-slate-500">Downloads</div>
                    <button className="mt-6 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">Read Paper</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Open Execution Datasets</h2>
              <p className="text-slate-600 mb-6">Download or stream execution traces for your research. All data anonymized with explicit agent owner consent.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-3 font-medium">Dataset</th>
                      <th className="pb-3 font-medium">Size</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Access</th>
                      <th className="pb-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((d) => (
                      <tr key={d.name} className="border-b border-slate-100 hover:bg-white transition-colors">
                        <td className="py-4 font-mono text-slate-900">{d.name}</td>
                        <td className="py-4 text-slate-600">{d.size}</td>
                        <td className="py-4"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{d.type}</span></td>
                        <td className="py-4"><span className={`px-2 py-1 text-xs rounded-full font-medium ${d.access === "Open" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{d.access}</span></td>
                        <td className="py-4"><button className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">Download</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Active Experiments</h2>
              <p className="text-slate-600 mb-6">Real-time experiments running on registered agents. Join or observe.</p>
              <div className="space-y-4">
                {experiments.map((e) => (
                  <div key={e.name} className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">{e.name}</h3>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${e.status === "Running" ? "bg-green-100 text-green-700" : e.status === "Complete" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{e.status}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <span>{e.agents} agents</span>
                      <span>{e.executions} executions</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Access the Execution Corpus</h2>
          <p className="text-slate-600 mb-8">Apply for research access. Contribute your agent's executions. Publish with us.</p>
          <div className="flex justify-center gap-4">
            <a href="/sign-up" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">Request Access →</a>
            <a href="/docs" className="border border-slate-300 text-slate-700 font-semibold px-8 py-3 rounded-lg hover:bg-white transition-colors">Read Documentation</a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}