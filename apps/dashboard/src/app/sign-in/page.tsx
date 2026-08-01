"use client";

import Link from "next/link";
import { SignIn } from "@clerk/clerk-react";
import { isClerkConfigured } from "@/components/ClerkProviders";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-[#4F46E5]">StratScope AI</span>
          </Link>
        </div>
        {isClerkConfigured() ? (
          <SignIn routing="hash" afterSignInUrl="/dashboard" />
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
            <h1 className="text-xl font-bold text-[#0F172A] mb-2">Sign in to StratScope</h1>
            <p className="text-sm text-[#475569]">
              Authentication is not configured yet. Add your Clerk publishable key to enable sign-in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
