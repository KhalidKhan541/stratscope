"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Settings</h2>
        <p className="text-[#475569]">Manage your account, API keys, and project settings.</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-4">API Keys</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Production Key</p>
                <p className="text-xs text-[#94A3B8] font-mono">sk_live_••••••••••••••••</p>
              </div>
              <button className="text-sm text-[#4F46E5] hover:text-[#4338CA] font-medium">Regenerate</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Project</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Project Name</label>
              <input
                type="text"
                defaultValue="My AI Project"
                className="w-full px-4 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Description</label>
              <textarea
                defaultValue="AI execution intelligence for production workloads"
                rows={3}
                className="w-full px-4 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Team</h3>
          <p className="text-sm text-[#475569] mb-4">Manage team members and their access levels.</p>
          <button className="px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors">
            Invite Member
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
