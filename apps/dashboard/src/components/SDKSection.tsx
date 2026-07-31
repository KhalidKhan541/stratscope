"use client";

import { useState } from "react";

const codeSnippet = `import { StratScope } from '@stratscope/sdk';

const stratscope = new StratScope({
  apiKey: process.env.STRATSCOPE_API_KEY,
  projectId: 'proj_enterprise_v1',
});

// Capture, normalize, and evaluate execution pipelines in real time
const execution = await stratscope.trace({
  agent: 'ResearchAgent',
  model: 'groq/llama-3.3-70b',
  input: promptPayload,
  execute: async () => runAgentTask(promptPayload),
});

console.log(\`Captured Immutable Execution ID: \${execution.id}\`);`;

export function SDKSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 px-6 bg-white border-y border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-xs font-semibold text-[#4F46E5] bg-[#4F46E5]/10 px-3 py-1 rounded-full mb-4">
              DEVELOPER SDK
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Integrate in minutes, not days
            </h2>
            <p className="text-lg text-[#475569] mb-8 leading-relaxed">
              A powerful TypeScript SDK that captures every execution with full context.
              Compatible with any AI framework or model provider.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#0F172A]">Type-Safe by Default</h4>
                  <p className="text-sm text-[#475569]">Full TypeScript support with auto-generated types from your schema.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#0F172A]">Edge-Native</h4>
                  <p className="text-sm text-[#475569]">Runs on Cloudflare Workers for sub-millisecond latency worldwide.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#0F172A]">Framework Agnostic</h4>
                  <p className="text-sm text-[#475569]">Works with LangChain, CrewAI, AutoGen, or custom agents.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5]/10 to-[#7C3AED]/10 blur-3xl rounded-3xl" />
            <div className="relative bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                </div>
                <span className="text-xs text-[#94A3B8] ml-2 font-mono">stratscope.ts</span>
                <button
                  onClick={handleCopy}
                  className="ml-auto text-xs text-[#94A3B8] hover:text-white transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="p-6 text-sm font-mono text-[#E2E8F0] overflow-x-auto leading-relaxed">
                <code>{codeSnippet}</code>
              </pre>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-sm text-[#94A3B8]">Install:</span>
              <code className="text-sm font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-[#4F46E5]">
                pnpm add @stratscope/sdk
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
