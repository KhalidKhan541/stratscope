import { MarketingLayout } from "@/components/layout/MarketingLayout";

export default function ExecutionsPage() {
  return (
    <MarketingLayout>
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-[#94A3B8] mb-6">
            <a href="/" className="hover:text-[#0F172A] transition-colors">Home</a>
            <span>/</span>
            <span className="text-[#0F172A]">Executions</span>
          </div>
          <h1 className="text-3xl font-bold text-[#0F172A] mb-4">Executions</h1>
          <p className="text-lg text-[#475569]">Connect your AI agent with the StratScope SDK to see executions here.</p>
        </div>
      </div>
    </MarketingLayout>
  );
}
