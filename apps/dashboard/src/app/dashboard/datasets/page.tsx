"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

const datasets = [
  { id: "ds-1", name: "Failure Analysis Q1 2026", records: 24500, size: "12.4 MB", format: "JSONL", created: "2026-01-15" },
  { id: "ds-2", name: "Reasoning Trajectories", records: 18200, size: "8.7 MB", format: "Parquet", created: "2026-02-20" },
  { id: "ds-3", name: "Model Routing Bench", records: 31000, size: "15.2 MB", format: "JSONL", created: "2026-03-10" },
];

export default function DatasetsPage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Datasets</h2>
          <p className="text-[#475569]">Research datasets built automatically from execution history.</p>
        </div>
        <button className="px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors">
          Build Dataset
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Name</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Records</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Size</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Format</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Created</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {datasets.map((ds) => (
              <tr key={ds.id} className="hover:bg-[#F8FAFC] transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-[#0F172A]">{ds.name}</td>
                <td className="px-6 py-4 text-sm font-mono text-[#475569]">{ds.records.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-[#475569]">{ds.size}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#4F46E5]/10 text-[#4F46E5]">
                    {ds.format}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#94A3B8]">{ds.created}</td>
                <td className="px-6 py-4">
                  <button className="text-sm text-[#4F46E5] hover:text-[#4338CA] font-medium">Download</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
