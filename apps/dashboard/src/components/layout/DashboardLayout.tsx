"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ClerkProvider, useUser, useClerk, SignInButton } from "@clerk/clerk-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Executions", href: "/dashboard/executions", icon: "⚡" },
  { name: "Analytics", href: "/dashboard/analytics", icon: "📈" },
  { name: "Research Agents", href: "/dashboard/research", icon: "🤖" },
  { name: "Datasets", href: "/dashboard/datasets", icon: "🗃️" },
  { name: "Benchmarks", href: "/dashboard/benchmarks", icon: "🏁" },
  { name: "Settings", href: "/dashboard/settings", icon: "⚙️" },
];

function ClerkWrapper({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key || key === "pk_test_placeholder") return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={key}
      routerPush={(to: string) => { window.location.href = to; }}
      routerReplace={(to: string) => { window.location.replace(to); }}
    >
      {children}
    </ClerkProvider>
  );
}

function AuthGuard({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasClerk = !!key && key !== "pk_test_placeholder";
  if (!hasClerk) return <>{children}</>;
  return <ClerkAuthGuard>{children}</ClerkAuthGuard>;
}

function ClerkAuthGuard({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();

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
          <Image src="/images/logo.svg" alt="StratScope" width={48} height={48} className="mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[#0F172A] mb-2">Sign in to StratScope</h1>
          <p className="text-[#475569] mb-6">Access your AI Execution Intelligence dashboard.</p>
          <SignInButton mode="modal">
            <button className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors">
              Sign In
            </button>
          </SignInButton>
          <p className="mt-4 text-sm text-[#94A3B8]">
            Don&apos;t have an account?{" "}
            <Link href="/" className="text-[#4F46E5] hover:text-[#4338CA] font-medium">
              Get started free
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Sidebar() {
  const pathname = usePathname();
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasClerk = !!key && key !== "pk_test_placeholder";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-full bg-white border-r border-[#E2E8F0]",
        "transition-all duration-300 ease-out",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="flex flex-col h-full">
        <div className={cn("flex items-center gap-3 px-5 py-5 border-b border-[#E2E8F0]", collapsed && "justify-center")}>
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/images/logo.svg" alt="StratScope" width={32} height={32} priority />
            {!collapsed && (
              <span className="text-lg font-bold text-[#0F172A]">StratScope</span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn("ml-auto p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors", collapsed && "rotate-180")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#4F46E5]/10 text-[#4F46E5]"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]",
                  collapsed && "justify-center px-2"
                )}
              >
                <span className="text-lg">{item.icon}</span>
                {!collapsed && <span>{item.name}</span>}
                {isActive && !collapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className={cn("p-4 border-t border-[#E2E8F0]", collapsed && "hidden")}>
          {hasClerk ? <ClerkSidebarUser /> : (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 rounded-full bg-[#4F46E5] flex items-center justify-center text-white font-medium text-sm">U</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A] truncate">User</p>
                <p className="text-xs text-[#94A3B8] truncate">user@example.com</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function ClerkSidebarUser() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U";
  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.emailAddresses?.[0]?.emailAddress || "User";
  const email = user?.emailAddresses?.[0]?.emailAddress || "";

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="w-9 h-9 rounded-full bg-[#4F46E5] flex items-center justify-center text-white font-medium text-sm overflow-hidden">
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt={displayName} className="w-9 h-9 rounded-full" />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A] truncate">{displayName}</p>
        <p className="text-xs text-[#94A3B8] truncate">{email}</p>
      </div>
      <button
        onClick={() => signOut({ redirectUrl: "/" })}
        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#F1F5F9] transition-colors"
        title="Sign out"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}

function Header() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasClerk = !!key && key !== "pk_test_placeholder";

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[#E2E8F0]">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-[#0F172A]">Dashboard</h1>
          <div className="hidden md:flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search executions, agents..." className="bg-transparent text-[#0F172A] placeholder-[#94A3B8] text-sm w-64 focus:outline-none" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full text-xs text-white flex items-center justify-center">3</span>
          </button>
          {hasClerk ? <ClerkHeaderUser /> : (
            <button className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white font-medium text-sm">U</button>
          )}
        </div>
      </div>
    </header>
  );
}

function ClerkHeaderUser() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="relative group">
      <button className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white font-medium text-sm overflow-hidden">
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt="User" className="w-8 h-8 rounded-full" />
        ) : (
          "U"
        )}
      </button>
      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg border border-[#E2E8F0] shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        <div className="px-4 py-2 border-b border-[#E2E8F0]">
          <p className="text-sm font-medium text-[#0F172A] truncate">{user?.emailAddresses?.[0]?.emailAddress}</p>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="w-full text-left px-4 py-2 text-sm text-[#475569] hover:bg-[#F8FAFC] transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkWrapper>
      <AuthGuard>
        <div className="min-h-screen bg-[#F8FAFC]">
          <Sidebar />
          <div className="transition-all duration-300 lg:ml-72">
            <Header />
            <main className="p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </AuthGuard>
    </ClerkWrapper>
  );
}
