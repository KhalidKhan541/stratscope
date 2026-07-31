"use client";

import { useState } from "react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";

const sections = [
  {
    icon: "🚀", title: "Getting Started", color: "#2563EB",
    items: ["Quick Start: Register Your First Agent", "SDK Installation (TypeScript / Python)", "Authentication & API Keys", "Your First Execution Submission", "Dashboard Overview", "Execution Data Schema"],
  },
  {
    icon: "📡", title: "SDK Reference", color: "#7C3AED",
    items: ["TypeScript SDK", "Python SDK", "Client Configuration", "Execution Handle API", "Event Buffer", "Error Handling & Retries", "Streaming Executions"],
  },
  {
    icon: "🔌", title: "Agent Registration", color: "#059669",
    items: ["Register Agent API", "Agent Metadata Schema", "Opt-In Data Sharing Settings", "Revenue Share Configuration", "Agent Verification Process", "Webhook Notifications"],
  },
  {
    icon: "📊", title: "Execution Submission", color: "#D97706",
    items: ["Submit Execution API", "Execution Schema (tools, decisions, results)", "Streaming Large Executions", "Batch Submission", "Validation & Error Codes", "Execution Replay"],
  },
  {
    icon: "🏪", title: "Dataset Marketplace", color: "#DC2626",
    items: ["Browse Datasets API", "Purchase & Download", "Subscription Access", "Dataset Schema & Metadata", "Quality Scores & Metrics", "License Terms"],
  },
  {
    icon: "🏆", title: "Benchmarks & Evaluation", color: "#0891B2",
    items: ["Run Benchmark API", "Available Benchmarks", "Custom Benchmark Creation", "Comparison Reports", "Leaderboard API", "Historical Results"],
  },
];

const tsCode = `import { StratScopeSDK } from '@stratscope/sdk';

// Initialize client
const client = new StratScopeSDK({
  apiKey: process.env.STRATSCOPE_API_KEY,
  projectId: 'proj_abc123'
});

// Register your agent
const agent = await client.agents.register({
  name: 'MyCodingAgent',
  type: 'coding',
  description: 'Autonomous bug fixing agent',
  capabilities: ['read_file', 'edit_file', 'run_tests', 'search_code']
});

console.log(\`Agent registered: \${agent.id}\`);

// Submit an execution
const execution = await client.executions.create({
  agentId: agent.id,
  task: "Fix authentication timeout bug",
  input: { issue: "PR #234 - login times out" },
  steps: [
    { tool: "read_file", input: "src/auth/session.ts" },
    { tool: "search_code", input: "timeout" },
    { tool: "edit_file", input: "src/auth/session.ts", diff: "..." },
    { tool: "run_tests", input: "npm test -- auth" }
  ],
  output: { result: "success", testsPassed: 24 },
  metrics: { latencyMs: 4200, tokensUsed: 1847, costUsd: 0.023 }
});

console.log(\`Execution recorded: \${execution.id}\`);

// Opt in to data sharing (earn revenue)
await client.agents.updateSharing(agent.id, {
  shareLevel: 'anonymized', // or 'none' | 'full'
  revenueSharePercent: 70
});`;

const pyCode = `from stratscope import StratScopeClient

client = StratScopeClient(
    api_key=os.environ["STRATSCOPE_API_KEY"],
    project_id="proj_abc123"
)

# Register agent
agent = client.agents.register(
    name="MyCodingAgent",
    type="coding",
    description="Autonomous bug fixing agent",
    capabilities=["read_file", "edit_file", "run_tests", "search_code"]
)

print(f"Agent registered: {agent.id}")

# Submit execution
execution = client.executions.create(
    agent_id=agent.id,
    task="Fix authentication timeout bug",
    input={"issue": "PR #234 - login times out"},
    steps=[
        {"tool": "read_file", "input": "src/auth/session.ts"},
        {"tool": "search_code", "input": "timeout"},
        {"tool": "edit_file", "input": "src/auth/session.ts", "diff": "..."},
        {"tool": "run_tests", "input": "npm test -- auth"}
    ],
    output={"result": "success", "tests_passed": 24},
    metrics={"latency_ms": 4200, "tokens_used": 1847, "cost_usd": 0.023}
)

print(f"Execution recorded: {execution.id}")

# Opt in to data sharing
client.agents.update_sharing(agent.id,
    share_level="anonymized",
    revenue_share_percent=70
)`;

const apiCode = `# Submit execution via REST API
curl -X POST https://api.stratscope.com/v1/executions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "agent_seea_01",
    "task": "Fix authentication timeout bug",
    "input": {"issue": "PR #234 - login times out"},
    "steps": [
      {"tool": "read_file", "input": "src/auth/session.ts"},
      {"tool": "search_code", "input": "timeout"},
      {"tool": "edit_file", "input": "src/auth/session.ts", "diff": "..."},
      {"tool": "run_tests", "input": "npm test -- auth"}
    ],
    "output": {"result": "success", "tests_passed": 24},
    "metrics": {"latency_ms": 4200, "tokens_used": 1847, "cost_usd": 0.023}
  }'

# Response
{
  "id": "exec_abc123",
  "agent_id": "agent_seea_01",
  "status": "recorded",
  "dataset_generated": "seea_auth_fix_v3.jsonl",
  "revenue_estimate_usd": 0.0034
}`;

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("typescript");

  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">DOCUMENTATION</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Build with StratScope</h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Register agents, submit executions, access datasets, run benchmarks. Everything you need in one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {sections.map((s) => (
              <div key={s.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ backgroundColor: `${s.color}10` }}>{s.icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{s.title}</h3>
                <ul className="space-y-2">
                  {s.items.map((item) => (
                    <li key={item} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="text-slate-400">→</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-6">Quick Start: Register & Submit in 5 Minutes</h2>
          <div className="flex gap-4 mb-4 border-b border-slate-200">
            {["typescript", "python", "rest"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {tab === "typescript" ? "TypeScript" : tab === "python" ? "Python" : "REST API"}
              </button>
            ))}
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-slate-400 text-sm font-mono">{activeTab === "typescript" ? "quickstart.ts" : activeTab === "python" ? "quickstart.py" : "curl.sh"}</span>
            </div>
            <pre className="text-green-400 font-mono text-sm overflow-x-auto leading-relaxed">
              <code>{activeTab === "typescript" ? tsCode : activeTab === "python" ? pyCode : apiCode}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Popular Guides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Register Your First Agent", desc: "Get your agent ID and start recording executions in 5 minutes", time: "5 min" },
              { title: "Stream Large Executions", desc: "Submit long-running executions without timeout issues", time: "8 min" },
              { title: "Opt In to Data Sharing", desc: "Configure anonymization and revenue share settings", time: "3 min" },
              { title: "Run Your First Benchmark", desc: "Evaluate your agent against SWE-Bench, WebArena, and more", time: "10 min" },
              { title: "Access Dataset Marketplace", desc: "Browse, purchase, and download execution datasets", time: "5 min" },
              { title: "Execution Replay & Debugging", desc: "Replay any execution trace to debug agent behavior", time: "7 min" },
            ].map((g) => (
              <div key={g.title} className="bg-white rounded-xl p-5 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-bold shrink-0">{g.time}</div>
                <div>
                  <h4 className="font-semibold text-slate-900">{g.title}</h4>
                  <p className="text-sm text-slate-500">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Need Help?</h2>
          <p className="text-slate-600 mb-8">Our engineering team helps you integrate fast. Join the community.</p>
          <div className="flex justify-center gap-4">
            <a href="/sign-up" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">Start Free →</a>
            <a href="/pricing" className="border border-slate-300 text-slate-700 font-semibold px-8 py-3 rounded-lg hover:bg-white transition-colors">Contact Support</a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}