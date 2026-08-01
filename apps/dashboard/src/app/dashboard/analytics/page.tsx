"use client";

import Link from "next/link";
import { useUser } from "@clerk/clerk-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { isClerkConfigured } from "@/components/ClerkProviders";

const metrics = [
  { label: "Total Executions", value: "12,847", change: "+12.5%", positive: true },
  { label: "Success Rate", value: "97.2%", change: "+2.1%", positive: true },
  { label: "Avg Latency", value: "234ms", change: "-15ms", positive: true },
  { label: "Total Cost", value: "$142.30", change: "+$18.40", positive: false },
];

const modelUsage = [
  { name: "Groq Llama 3.3 70B", executions: 8420, percentage: 65.5 },
  { name: "Groq Mixtral 8x7B", executions: 2847, percentage: 22.2 },
  { name: "OpenAI GPT-4o", executions: 1024, percentage: 8.0 },
  { name: "Anthropic Claude 3.5", executions: 556, percentage: 4.3 },
];

function AnalyticsWelcome() {
  const { user, isLoaded } = useUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isLoaded || !email) return null;

  return (
    <p className="mt-2 text-sm text-[#475569]">
      Welcome, <span className="font-medium text-[#0F172A]">{email}</span>. Here&apos;s how your agents are performing.
    </p>
  );
}

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Analytics</h2>
        <p className="text-[#475569]">Performance metrics and cost analysis across all executions.</p>
        {isClerkConfigured() && <AnalyticsWelcome />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <p className="text-sm text-[#475569] mb-1">{metric.label}</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[#0F172A]">{metric.value}</span>
              <span className={`text-xs font-medium mb-1 ${metric.positive ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-6">Model Usage Distribution</h3>
          <div className="space-y-4">
            {modelUsage.map((model) => (
              <div key={model.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[#0F172A]">{model.name}</span>
                  <span className="text-sm text-[#94A3B8]">{model.percentage}%</span>
                </div>
                <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4F46E5] rounded-full"
                    style={{ width: `${model.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-6">Execution Status</h3>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="8" strokeDasharray="220 252" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#EF4444" strokeWidth="8" strokeDasharray="20 252" strokeDashoffset="-220" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="8" strokeDasharray="12 252" strokeDashoffset="-240" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#0F172A]">97.2%</div>
                  <div className="text-xs text-[#94A3B8]">Success</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981]" />
              <span className="text-xs text-[#475569]">Completed (97.2%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <span className="text-xs text-[#475569]">Failed (1.8%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <span className="text-xs text-[#475569]">Running (1.0%)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl border border-[#E2E8F0] p-6 flex items-start gap-4">
        <span className="text-xl">🔑</span>
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Your API key</h3>
          <p className="text-sm text-[#475569]">
            Create an API key via the developers page in{" "}
            <Link href="/dashboard/settings" className="text-[#4F46E5] hover:text-[#4338CA] font-medium">
              Settings
            </Link>{" "}
            to connect your SDK and stream agent executions into StratScope.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
