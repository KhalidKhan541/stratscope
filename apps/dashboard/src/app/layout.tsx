import type { Metadata } from "next";
import "./globals.css";
import { ClerkProviders } from "@/components/ClerkProviders";

export const metadata: Metadata = {
  title: "StratScope — AI Execution Intelligence",
  description: "The Operating System for Production AI. Capture every AI execution. Transform traces into organizational intelligence.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-[#0F172A] antialiased">
        <ClerkProviders>{children}</ClerkProviders>
      </body>
    </html>
  );
}
