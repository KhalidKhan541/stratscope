"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ClerkProvider, useUser, SignInButton, SignUpButton } from "@clerk/clerk-react";

function Dropdown({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
        {label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
      <span className="text-lg mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </Link>
  );
}

function ClerkAuthButtons() {
  const { isSignedIn } = useUser();
  return (
    <>
      {isSignedIn ? (
        <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">
          Dashboard
        </Link>
      ) : (
        <SignInButton mode="modal">
          <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">
            Sign in
          </button>
        </SignInButton>
      )}
      <SignUpButton mode="modal">
        <button className="bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Start Free
        </button>
      </SignUpButton>
    </>
  );
}

function MarketingHeader() {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_placeholder";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.svg" alt="StratScope" width={28} height={28} priority />
            <span className="text-lg font-bold tracking-tight text-slate-900">STRATSCOPE</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            <Dropdown label="Product">
              <DropdownItem href="/datasets" icon="📦" title="Datasets" desc="High-quality training data" />
              <DropdownItem href="/benchmarks" icon="📊" title="Benchmarks" desc="Evaluate model performance" />
              <DropdownItem href="/agents" icon="🤖" title="AI Agents" desc="Agent-specific datasets" />
              <DropdownItem href="/pricing" icon="💳" title="API Access" desc="Programmatic access" />
            </Dropdown>
            <Dropdown label="Solutions">
              <DropdownItem href="/solutions" icon="🚀" title="AI Startups" desc="Ship smarter agents faster" />
              <DropdownItem href="/solutions" icon="🏢" title="Enterprises" desc="Deploy AI with confidence" />
              <DropdownItem href="/solutions" icon="🔬" title="Research Labs" desc="Accelerate research" />
              <DropdownItem href="/solutions" icon="🎓" title="Universities" desc="Academic licensing" />
            </Dropdown>
            <Link href="/datasets" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Datasets</Link>
            <Link href="/pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/docs" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Docs</Link>
            <Dropdown label="Company">
              <DropdownItem href="/company" icon="ℹ️" title="About" desc="Our mission and team" />
              <DropdownItem href="/research" icon="📄" title="Research" desc="Technical reports" />
              <DropdownItem href="/company" icon="📋" title="Careers" desc="Join our team" />
              <DropdownItem href="/company" icon="📰" title="Press Kit" desc="Brand assets" />
            </Dropdown>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {hasClerk ? (
            <ClerkAuthButtons />
          ) : (
            <>
              <Link href="/sign-in" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">
                Sign in
              </Link>
              <Link href="/sign-up" className="bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Start Free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ClerkWrapper({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key || key === "pk_test_placeholder") return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={key}
      routerPush={(to: string) => window.location.href = to}
      routerReplace={(to: string) => window.location.replace(to)}
    >
      {children}
    </ClerkProvider>
  );
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkWrapper>
      <div className="min-h-screen bg-white">
        <MarketingHeader />
        <main className="pt-16">{children}</main>

        <footer className="border-t border-slate-200 bg-slate-50 py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <Image src="/images/logo.svg" alt="StratScope" width={24} height={24} />
                  <span className="font-bold text-slate-900">STRATSCOPE</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                  The intelligence layer for AI agents. Premium datasets, benchmarks, and research.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-4">Product</h4>
                <ul className="space-y-2.5">
                  <li><Link href="/datasets" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Datasets</Link></li>
                  <li><Link href="/benchmarks" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Benchmarks</Link></li>
                  <li><Link href="/agents" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">AI Agents</Link></li>
                  <li><Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-4">Resources</h4>
                <ul className="space-y-2.5">
                  <li><Link href="/docs" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Documentation</Link></li>
                  <li><Link href="/docs" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">API Reference</Link></li>
                  <li><Link href="/research" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Research</Link></li>
                  <li><Link href="/company" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Blog</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-4">Company</h4>
                <ul className="space-y-2.5">
                  <li><Link href="/company" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">About</Link></li>
                  <li><Link href="/solutions" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Solutions</Link></li>
                  <li><Link href="/company" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Careers</Link></li>
                  <li><Link href="/company" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Press Kit</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-4">Legal</h4>
                <ul className="space-y-2.5">
                  <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Terms of Service</a></li>
                  <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Security</a></li>
                  <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">DPA</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400">&copy; 2026 StratScope. All rights reserved.</p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" /></svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ClerkWrapper>
  );
}
