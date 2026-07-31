"use client";

import { MarketingLayout } from "@/components/layout/MarketingLayout";

const plans = [
  {
    name: "Developer", price: "$0", period: "/month",
    desc: "Free for individual agent builders. Register agents, submit executions, get analytics.",
    cta: "Start Free", ctaStyle: "border border-slate-300 text-slate-700 hover:bg-slate-50",
    features: [
      { text: "Unlimited agent registrations", included: true },
      { text: "Unlimited execution submissions", included: true },
      { text: "Real-time execution analytics", included: true },
      { text: "Cost & latency tracking", included: true },
      { text: "Error pattern detection", included: true },
      { text: "Opt-in data sharing (70% revenue share)", included: true },
      { text: "Public benchmark access", included: true },
      { text: "Dataset marketplace browsing", included: true },
      { text: "Private datasets & benchmarks", included: false },
      { text: "Team collaboration", included: false },
      { text: "SSO & RBAC", included: false },
      { text: "Dedicated support", included: false },
    ],
  },
  {
    name: "Team", price: "$99", period: "/month", popular: true,
    desc: "For teams building and deploying agents. Private workspaces, shared benchmarks, advanced analytics.",
    cta: "Start Team Trial", ctaStyle: "bg-blue-600 text-white hover:bg-blue-700",
    features: [
      { text: "Everything in Developer", included: true },
      { text: "5 team members", included: true },
      { text: "Private workspaces", included: true },
      { text: "Shared execution analytics", included: true },
      { text: "Private benchmark runs", included: true },
      { text: "Custom evaluation criteria", included: true },
      { text: "Dataset creation from team executions", included: true },
      { text: "Revenue share on team datasets (70%)", included: true },
      { text: "API access for CI/CD integration", included: true },
      { text: "Email & Slack alerts", included: true },
      { text: "SSO (SAML/OIDC)", included: false },
      { text: "Dedicated support", included: false },
    ],
  },
  {
    name: "Enterprise", price: "Custom", period: "",
    desc: "For organizations deploying agents at scale. Full governance, compliance, and dedicated infrastructure.",
    cta: "Contact Sales", ctaStyle: "border border-slate-300 text-slate-700 hover:bg-slate-50",
    features: [
      { text: "Everything in Team", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Dedicated infrastructure", included: true },
      { text: "Custom data retention policies", included: true },
      { text: "SOC 2 / HIPAA / GDPR compliance", included: true },
      { text: "Private dataset marketplace", included: true },
      { text: "Custom revenue share terms", included: true },
      { text: "On-premise deployment option", included: true },
      { text: "Dedicated solutions engineer", included: true },
      { text: "SLA with uptime guarantees", included: true },
      { text: "SSO & advanced RBAC", included: true },
      { text: "Custom integrations", included: true },
    ],
  },
];

const revenueShare = [
  { step: "1", title: "Agent Owner Opts In", desc: "Choose anonymized or full sharing. Set revenue split (default 70/30)." },
  { step: "2", title: "Executions Flow In", desc: "Every execution your agent runs is recorded and normalized automatically." },
  { step: "3", title: "Datasets Are Generated", desc: "Our pipeline creates datasets: failures, reasoning, multi-agent, metrics." },
  { step: "4", title: "Buyers Purchase", desc: "AI companies buy datasets for training, evaluation, and research." },
  { step: "5", title: "You Get Paid", desc: "Monthly payouts. Transparent reporting. You own your data." },
];

const faqs = [
  { q: "What does 'execution submission' mean?", a: "Every time your agent completes a task (coding, browsing, research, etc.), you send us the trace: tool calls, decisions, results, metrics. One API call per execution." },
  { q: "How does revenue sharing work?", a: "When you opt in, your anonymized executions are included in datasets we sell. You get 70% of revenue from datasets containing your agent's data. Paid monthly via Stripe." },
  { q: "Can I use StratScope without sharing data?", a: "Yes! Default is 'no sharing'. You get all analytics, benchmarks, and execution replay for free. Only opt in if you want to earn from your data." },
  { q: "What anonymization do you apply?", a: "We strip all PII, API keys, proprietary code snippets, and identifiable patterns. You can choose 'anonymized' (patterns preserved) or 'full' (raw traces with consent)." },
  { q: "How are dataset prices determined?", a: "Based on trace quality, rarity, buyer demand, and category. Failure recovery traces: $0.15-0.25/trace. Reasoning traces: $0.10-0.20/trace. Metrics: $0.08-0.12/trace." },
  { q: "Can I remove my data later?", a: "Yes. Disable sharing anytime. Future datasets won't include your traces. Already-sold datasets remain (anonymized). You keep revenue earned to date." },
];

export default function PricingPage() {
  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">PRICING</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-slate-600">Free to build. Earn when your data sells. Pay only for team features.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {plans.map((p) => (
              <div key={p.name} className={`relative rounded-2xl border p-8 ${p.popular ? "border-blue-600 shadow-xl ring-1 ring-blue-600" : "border-slate-200"}`}>
                {p.popular && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">BEST FOR TEAMS</div>}
                <h3 className="text-xl font-bold text-slate-900">{p.name}</h3>
                <div className="mt-4 mb-4">
                  <span className="text-4xl font-bold text-slate-900">{p.price}</span>
                  <span className="text-slate-500">{p.period}</span>
                </div>
                <p className="text-sm text-slate-600 mb-6">{p.desc}</p>
                <button className={`w-full py-3 rounded-lg font-semibold transition-colors mb-8 ${p.ctaStyle}`}>{p.cta}</button>
                <ul className="space-y-3">
                  {p.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-3 text-sm">
                      <span className={f.included ? "text-green-500" : "text-slate-300"}>{f.included ? "✓" : "—"}</span>
                      <span className={f.included ? "text-slate-700" : "text-slate-400"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-3xl p-12 mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">How Revenue Sharing Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
              {revenueShare.map((r) => (
                <div key={r.step} className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600 mx-auto mb-3">{r.step}</div>
                  <h4 className="font-semibold text-slate-900 mb-1">{r.title}</h4>
                  <p className="text-sm text-slate-600">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-12 mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {faqs.map((f) => (
                <div key={f.q} className="bg-white rounded-xl p-6 border border-slate-200">
                  <h4 className="font-semibold text-slate-900 mb-2">{f.q}</h4>
                  <p className="text-sm text-slate-600">{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to Start?</h2>
            <p className="text-slate-600 mb-8">Free to register agents. No credit card. Start earning from your execution data today.</p>
            <a href="/sign-up" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">Register Your Agent Free →</a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}