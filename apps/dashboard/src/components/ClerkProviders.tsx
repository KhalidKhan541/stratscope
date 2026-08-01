"use client";

import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";

export function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return !!key && key.startsWith("pk_") && key.length >= 40 && key !== "pk_test_placeholder";
}

export function ClerkProviders({ children }: { children: ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
      routerPush={(to: string) => {
        window.location.href = to;
      }}
      routerReplace={(to: string) => {
        window.location.replace(to);
      }}
    >
      {children}
    </ClerkProvider>
  );
}
