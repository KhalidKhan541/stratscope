"use client";

import Link from "next/link";
import Image from "next/image";
import { MarketingLayout } from "@/components/layout/MarketingLayout";

const trustedBy = ["ScaleFlow", "OpenMind AI", "NEXORA", "Vertex Labs", "CogniCore", "FutureAGI"];

const features = [
  { icon: "📦", title: "Premium Datasets", desc: "Curated, cleaned, and validated datasets across diverse domains ready for training and fine-tuning." },
  { icon: "📊", title: "Benchmarks & Eval", desc: "Industry-standard benchmarks and evaluation frameworks to measure real-world performance." },
  { icon: "📄", title: "Research & Reports", desc: "In-depth market and industry intelligence to inform strategies and drive decisions." },
  { icon: "🤖", title: "Agent-Ready", desc: "Data and APIs designed for seamless integration into your AI agent workflows." },
];

const steps = [
  { num: "1", title: "Discover", desc: "Explore our extensive catalog of datasets, benchmarks, and reports across multiple domains." },
  { num: "2", title: "Access", desc: "Seamlessly access the data via API or download. Built for speed, scale, and reliability." },
  { num: "3", title: "Build & Scale", desc: "Train better models, evaluate with confidence, and build smarter AI agents." },
];

const stats = [
  { value: "1,248", label: "Total Datasets", change: "+18% this month" },
  { value: "342", label: "Benchmarks", change: "+24% this month" },
  { value: "532", label: "Reports", change: "+12% this month" },
  { value: "2.4M", label: "API Calls", change: "+37% this month" },
];

const categories = [
  { name: "General Knowledge", count: "240 datasets", icon: "📚" },
  { name: "Coding & Engineering", count: "186 datasets", icon: "💻" },
  { name: "Finance", count: "132 datasets", icon: "💰" },
  { name: "Healthcare", count: "156 datasets", icon: "🏥" },
  { name: "Legal", count: "98 datasets", icon: "⚖️" },
  { name: "Research & Academia", count: "210 datasets", icon: "🔬" },
];

export default function LandingPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 via-white to-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-6">
                <span className="text-sm">🤖</span>
                <span className="text-sm font-medium text-blue-700">AI INTELLIGENCE FOR THE NEXT GENERATION</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] mb-6">
                The Intelligence Layer for{" "}
                <span className="text-blue-600">AI Agents</span>
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
                StratScope builds premium datasets, benchmarks, and research that power smarter AI agents. From training data to market intelligence, we provide the information AI systems learn from and businesses rely on.
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                <Link href="/datasets" className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                  Explore Datasets
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
                <Link href="/pricing" className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 font-semibold px-6 py-3 rounded-lg hover:bg-slate-50 transition-colors">
                  Book a Demo
                </Link>
              </div>
              <div className="flex flex-wrap gap-6">
                {["Premium Quality · Curated & Validated", "Built for AI · Agent-Ready Data", "Trusted by Builders · AI Companies & Startups"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-purple-100 blur-3xl rounded-full" />
              <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-slate-400 ml-2 font-mono">stratscope-dashboard</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-slate-900 mb-3">Overview</p>
                  <div className="grid grid-cols-4 gap-3">
                    {stats.map((s) => (
                      <div key={s.label} className="bg-white rounded-lg p-3 border border-slate-100">
                        <p className="text-xs text-slate-500">{s.label}</p>
                        <p className="text-lg font-bold text-slate-900">{s.value}</p>
                        <p className="text-[10px] text-green-600">{s.change}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {categories.map((c) => (
                    <div key={c.name} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{c.icon}</span>
                        <span className="text-xs font-medium text-slate-700 truncate">{c.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{c.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-12 border-y border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-8">Trusted by AI companies and innovators worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-12">
            {trustedBy.map((name) => (
              <span key={name} className="text-lg font-bold text-slate-300 hover:text-slate-400 transition-colors">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Why StratScope */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-4">WHY STRATSCOPE</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">High-Quality Data. Deeper Intelligence. Better AI.</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">AI agents are only as good as the data they learn from. StratScope provides meticulously curated datasets, rigorous benchmarks, and actionable intelligence to help you build, evaluate, and scale with confidence.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl mb-4 group-hover:bg-blue-100 transition-colors">{f.icon}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-4">HOW IT WORKS</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">From Data to Decisions in Three Simple Steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((s, i) => (
              <div key={s.num} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/25">
                  <span className="text-2xl font-bold text-white">{s.num}</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{s.title}</h3>
                <p className="text-slate-600 leading-relaxed">{s.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%]">
                    <svg className="w-full h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 100 10">
                      <path strokeLinecap="round" strokeDasharray="5 5" d="M0 5 L95 5" strokeWidth="2" />
                      <path strokeLinecap="round" d="M90 1 L98 5 L90 9" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to power your AI with intelligence that matters?</h2>
          <p className="text-lg text-blue-100 mb-8">Join hundreds of AI teams and startups using StratScope to build better agents with trusted data and insights.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-8 py-3.5 rounded-lg hover:bg-blue-50 transition-colors">
              Start Free Today
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 border border-white/30 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-white/10 transition-colors">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
