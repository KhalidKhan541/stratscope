"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/clerk-react";
import { isClerkConfigured } from "@/components/ClerkProviders";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;
  return <AuthGate>{children}</AuthGate>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#94A3B8]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-2">Sign in required</h1>
          <p className="text-[#475569] mb-6">You need to sign in to access the dashboard.</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
