"use client";

const stages = [
  {
    number: "01",
    title: "Execution Ingestion",
    description: "Raw telemetry events are ingested from AI agents and production SDKs in real-time.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: "#4F46E5",
  },
  {
    number: "02",
    title: "Normalization",
    description: "Disparate agent payloads are standardized into unified domain schemas.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    color: "#7C3AED",
  },
  {
    number: "03",
    title: "Evaluation",
    description: "Automated scoring engines evaluate reasoning chains, measure hallucination rates, and isolate failure modes.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "#10B981",
  },
  {
    number: "04",
    title: "Knowledge Extraction",
    description: "Reflections are distilled into actionable organizational memory and learning signals.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: "#F59E0B",
  },
  {
    number: "05",
    title: "Dataset & Benchmark Builder",
    description: "Versioned corpora covering model routing, tool comparison, and prompt performance are continuously compiled.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    color: "#EC4899",
  },
  {
    number: "06",
    title: "Research API",
    description: "Immutable artifacts are exposed for fine-tuning, model evaluation, and export via JSONL, Parquet, and Apache Arrow.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: "#06B6D4",
  },
];

export function PipelineSection() {
  return (
    <section id="platform" className="py-24 px-6 bg-white border-y border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold text-[#4F46E5] bg-[#4F46E5]/10 px-3 py-1 rounded-full mb-4">
            PLATFORM ARCHITECTURE
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
            Execution Intelligence Operating System
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            From raw telemetry to continuous learning. Every stage produces immutable artifacts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((stage, i) => (
            <div
              key={stage.number}
              className="relative p-6 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#4F46E5]/30 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${stage.color}10`, color: stage.color }}
                >
                  {stage.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-[#94A3B8]">{stage.number}</span>
                    <h3 className="text-base font-semibold text-[#0F172A]">{stage.title}</h3>
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed">{stage.description}</p>
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-6 text-[#E2E8F0]">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
