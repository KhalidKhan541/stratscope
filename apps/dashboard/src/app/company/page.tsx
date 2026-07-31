"use client";

import { MarketingLayout } from "@/components/layout/MarketingLayout";

const values = [
  { icon: "🎯", title: "Execution First", desc: "Every AI interaction is an execution. Every execution creates intelligence. We never lose data." },
  { icon: "🔬", title: "Research Driven", desc: "We publish research, open-source tools, and benchmarks. We advance the field while building the platform." },
  { icon: "🏗️", title: "Infrastructure Mindset", desc: "We build for the long term. Every decision is made for 1 billion executions, not 1 million." },
  { icon: "🤝", title: "Customer Obsession", desc: "We succeed when our customers succeed. We build what they need, not what's trendy." },
  { icon: "📐", title: "Simplicity", desc: "Complex problems deserve simple solutions. We eliminate complexity, not add to it." },
  { icon: "🌍", title: "Open by Default", desc: "Open protocols, open standards, open datasets. We believe in building in the open." },
];

const timeline = [
  { year: "2024", title: "Founded", desc: "StratScope founded with the mission to build execution intelligence infrastructure for AI." },
  { year: "2025", title: "EIOS Invention", desc: "Invented the Execution Intelligence Operating System concept. Built the core pipeline engine." },
  { year: "2025", title: "First Customers", desc: "Onboarded first 50 enterprise customers. Tracked 10 million AI executions." },
  { year: "2026", title: "Platform Launch", desc: "Launching the full StratScope platform — SDK, API, Dashboard, Dataset Builder, Benchmark Runner." },
];

const team = [
  { name: "Khalid Khan", role: "Founder & CEO", avatar: "KK" },
];

const stats = [
  { value: "10M+", label: "Executions Tracked" },
  { value: "500+", label: "Enterprise Teams" },
  { value: "50+", label: "Team Members" },
  { value: "$15M", label: "Series A Raised" },
];

export default function CompanyPage() {
  return (
    <MarketingLayout>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm mb-4 tracking-wide uppercase">COMPANY</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">Building the Intelligence Layer for AI</h1>
            <p className="text-lg text-slate-600">We're on a mission to make every AI execution measurable, explainable, and continuously improving.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-6 rounded-2xl bg-slate-50">
                <p className="text-3xl font-bold text-blue-600">{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-20">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Our Story</h2>
            <div className="max-w-3xl mx-auto space-y-6 text-slate-600">
              <p>StratScope was born from a simple observation: AI is moving from experimentation to production, but the infrastructure to operate AI systems at scale doesn't exist yet.</p>
              <p>Today's tools focus on building AI. We focus on operating AI. When organizations run thousands of autonomous AI systems, they need execution intelligence — the ability to understand, explain, and improve every AI execution.</p>
              <p>Our Execution Intelligence Operating System (EIOS) turns every AI execution into immutable organizational intelligence. Nothing is lost. Nothing is overwritten. History is immutable.</p>
              <p>We're building the infrastructure layer that every production AI system will depend upon.</p>
            </div>
          </div>

          <div className="mb-20">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((v) => (
                <div key={v.title} className="p-6 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-3xl">{v.icon}</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-3 mb-2">{v.title}</h3>
                  <p className="text-sm text-slate-600">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-20">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Timeline</h2>
            <div className="max-w-2xl mx-auto relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-blue-200" />
              {timeline.map((t, i) => (
                <div key={t.year} className="relative pl-20 pb-10">
                  <div className="absolute left-6 w-5 h-5 rounded-full bg-blue-600 border-4 border-white" />
                  <span className="text-sm font-bold text-blue-600">{t.year}</span>
                  <h3 className="font-bold text-slate-900 mt-1">{t.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-20">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Leadership</h2>
            <div className="flex justify-center">
              {team.map((m) => (
                <div key={m.name} className="text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold mx-auto mb-4">{m.avatar}</div>
                  <h3 className="font-bold text-slate-900">{m.name}</h3>
                  <p className="text-sm text-slate-500">{m.role}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-12 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Join Us</h2>
            <p className="text-slate-600 mb-8">We're hiring passionate people who want to build the future of AI infrastructure.</p>
            <div className="flex justify-center gap-4">
              <a href="/pricing" className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">View Open Positions →</a>
              <a href="/docs" className="border border-slate-300 text-slate-700 font-semibold px-8 py-3 rounded-lg hover:bg-white transition-colors">Read Our Docs</a>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
