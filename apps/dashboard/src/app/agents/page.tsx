"use client";

import { useState } from "react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";

const agentTypes = [
  {
    id: "coding", icon: "</>", name: "Coding Agents", color: "#2563EB",
    desc: "Agents that write, review, debug, and refactor code. Includes SEEA, Copilot-style agents, and custom coding assistants.",
    executions: "1.2M+",
    datasets: ["Code generation traces", "Bug fix sequences", "Refactoring patterns", "Test generation flows", "Code review decisions", "Error recovery paths"],
    evaluation: ["Code correctness", "Test pass rate", "Style compliance", "Security issues", "Performance impact", "Maintainability"],
    benchmarks: ["HumanEval", "MBPP", "SWE-Bench", "CodeXGLUE", "BigCodeBench"],
    buyers: ["LLM training for coding", "Coding agent evaluation", "IDE autocomplete improvement"],
  },
  {
    id: "browser", icon: "🌐", name: "Browser Agents", color: "#059669",
    desc: "Agents that navigate websites, fill forms, extract data, and automate web workflows.",
    executions: "890K+",
    datasets: ["DOM interaction traces", "Form filling patterns", "Navigation decision trees", "Anti-bot bypass attempts", "Screenshot sequences", "Error recovery flows"],
    evaluation: ["Task completion rate", "Navigation accuracy", "Speed & efficiency", "Stealth score", "Error handling"],
    benchmarks: ["WebArena", "Mind2Web", "MiniWob++", "VisualWebArena", "AgentTrek"],
    buyers: ["Web automation training", "RPA improvement", "Browser agent evaluation"],
  },
  {
    id: "research", icon: "🔍", name: "Research Agents", color: "#7C3AED",
    desc: "Agents that gather, analyze, and synthesize information from diverse sources.",
    executions: "567K+",
    datasets: ["Search query patterns", "Source evaluation traces", "Synthesis decision paths", "Citation verification", "Fact-checking flows", "Report generation steps"],
    evaluation: ["Factual accuracy", "Source quality", "Completeness", "Recency awareness", "Citation correctness"],
    benchmarks: ["MS MARCO", "Natural Questions", "HotpotQA", "FEVER", "ARC Challenge"],
    buyers: ["Research assistant training", "Fact-checking systems", "Knowledge retrieval evaluation"],
  },
  {
    id: "customer", icon: "💬", name: "Customer Support Agents", color: "#D97706",
    desc: "Agents that handle customer queries, resolve tickets, and escalate when needed.",
    executions: "2.1M+",
    datasets: ["Conversation flows", "Escalation triggers", "Resolution patterns", "Sentiment trajectories", "Knowledge base lookups", "Human handoff points"],
    evaluation: ["Resolution rate", "CSAT score", "First contact resolution", "Escalation accuracy", "Response quality"],
    benchmarks: ["AgentBench", "CustomerServiceBench", "MT-Bench", "ConvAI2"],
    buyers: ["Support bot training", "Conversation analytics", "Escalation prediction"],
  },
  {
    id: "sales", icon: "📈", name: "Sales Agents", color: "#DC2626",
    desc: "Agents that qualify leads, write outreach, and manage pipelines.",
    executions: "434K+",
    datasets: ["Lead qualification traces", "Outreach generation", "Objection handling", "Pipeline decisions", "CRM update patterns", "Meeting scheduling flows"],
    evaluation: ["Lead accuracy", "Response personalization", "Conversion correlation", "Compliance adherence"],
    benchmarks: ["SalesBench", "LeadScoringBench", "OutreachBench", "CRMQB"],
    buyers: ["SD agent training", "Lead scoring models", "Sales conversation analysis"],
  },
  {
    id: "healthcare", icon: "🏥", name: "Healthcare Agents", color: "#0891B2",
    desc: "Agents that assist with medical documentation, coding, and patient interactions.",
    executions: "289K+",
    datasets: ["Clinical note generation", "ICD coding decisions", "Prior auth workflows", "Patient summary traces", "Drug interaction checks", "Compliance verification"],
    evaluation: ["Clinical accuracy", "Coding correctness", "Regulatory compliance", "Privacy adherence", "Patient safety"],
    benchmarks: ["MedQA", "PubMedQA", "ClinicalBench", "DrugBench", "ICD-Coding"],
    buyers: ["Medical scribe training", "Clinical coding automation", "Healthcare compliance"],
  },
];

const benefits = [
  { icon: "💰", title: "Earn from Your Data", desc: "Opt in to share anonymized executions. Get revenue share when datasets sell." },
  { icon: "📊", title: "Free Analytics", desc: "Real-time dashboards for your agent's performance, costs, and error patterns." },
  { icon: "🏆", title: "Benchmark Access", desc: "Compare your agent against industry benchmarks from real execution data." },
  { icon: "🔒", title: "Full Privacy Control", desc: "You choose what to share. Data is anonymized. You retain ownership." },
  { icon: "⚡", title: "5-Minute Setup", desc: "One SDK call per execution. We handle storage, normalization, and dataset generation." },
  { icon: "🤝", title: "Join the Network", desc: "Connect with other agent builders. Learn from shared execution patterns." },
];

export default function AgentsPage() {
  const [active, setActive] = useState("coding");
  const activeAgent = agentTypes.find((a) => a.id === active)!;

  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <a href="/" className="hover:text-slate-900">Home</a><span>/</span><span className="text-slate-900">AI Agents</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Register Your AI Agent</h1>
              <p className="text-lg text-slate-600 mb-2">Join 12,000+ agents contributing execution data to the world's largest execution dataset platform.</p>
              <p className="text-slate-500">Every execution your agent runs generates valuable data. Opt in to share anonymized traces and earn revenue when datasets are purchased by AI companies.</p>
            </div>
            <div className="relative">
              <div className="bg-slate-900 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-slate-500 text-xs font-mono">agent_registration</span>
                </div>
                <div className="space-y-2 font-mono text-sm">
                  <div className="text-cyan-400">$ stratscope register --name "MyCodingAgent"</div>
                  <div className="text-green-400">✓ Agent registered: agent_mycoding_01</div>
                  <div className="text-blue-400">$ stratscope opt-in --share-level anonymized</div>
                  <div className="text-green-400">✓ Execution sharing enabled</div>
                  <div className="text-purple-400">→ Dataset: coding_fixes_v12 available</div>
                  <div className="text-yellow-400">→ Revenue: $234.50 this month</div>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-6">Benefits of Registering</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 transition-all">
                <span className="text-3xl mb-3 block">{b.icon}</span>
                <h3 className="font-bold text-slate-900 mb-2">{b.title}</h3>
                <p className="text-sm text-slate-600">{b.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-6">Explore Agent Types</h2>
          <div className="flex flex-wrap gap-3 mb-8">
            {agentTypes.map((a) => (
              <button key={a.id} onClick={() => setActive(a.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${active === a.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-200"}`}>
                <span>{a.icon}</span>{a.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${activeAgent.color}10` }}>{activeAgent.icon}</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{activeAgent.name}</h3>
                  <p className="text-slate-500">{activeAgent.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Total Executions</p>
                <p className="font-semibold text-slate-900">{activeAgent.executions}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Execution Datasets", items: activeAgent.datasets, color: "#2563EB" },
                { title: "Evaluation Criteria", items: activeAgent.evaluation, color: "#059669" },
                { title: "Benchmarks", items: activeAgent.benchmarks, color: "#7C3AED" },
                { title: "Buyer Use Cases", items: activeAgent.buyers, color: "#D97706" },
              ].map((col) => (
                <div key={col.title}>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-xs text-white" style={{ backgroundColor: col.color }}>✓</span>
                    {col.title}
                  </h4>
                  <ul className="space-y-2">
                    {col.items.map((item) => (
                      <li key={item} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-slate-400 mt-1">•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {agentTypes.filter((a) => a.id !== active).map((a) => (
              <div key={a.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer" onClick={() => setActive(a.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{a.icon}</span>
                  <span className="font-semibold text-slate-900">{a.name}</span>
                  <span className="text-sm text-slate-500">{a.executions} executions</span>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to Register Your Agent?</h2>
          <p className="text-slate-600 mb-8">Start generating execution data. Earn from dataset sales. Join the network.</p>
          <a href="/sign-up" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">Register Your Agent Free →</a>
        </div>
      </section>
    </MarketingLayout>
  );
}