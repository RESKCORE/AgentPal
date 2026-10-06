import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/convex-provider";
import { SideNav } from "@/components/side-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://agentpal.vercel.app"),
  title: {
    default: "AgentPal - Deterministic Settlement Protocol for Autonomous AI Deals",
    template: "%s | AgentPal",
  },
  description:
    "Agents negotiate multi-parameter contracts within confidential human mandates. A zero-LLM TypeScript Settlement Kernel deterministically enforces boundaries, with automated deposit invoicing settled via PayPal Sandbox.",
  applicationName: "AgentPal",
  authors: [{ name: "AgentPal Protocol Team", url: "https://github.com/RESKCORE/AgentPal" }],
  keywords: [
    "AI negotiation",
    "autonomous agents",
    "PayPal Sandbox",
    "Settlement Kernel",
    "ZOPA",
    "smart contracts",
    "tamper-evident SHA-256",
    "b2b negotiation",
    "freelance escrow",
    "prompt injection defense",
    "deterministic AI safety",
  ],
  creator: "RESKCORE",
  publisher: "AgentPal",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/logo.png"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://agentpal.vercel.app",
    siteName: "AgentPal",
    title: "AgentPal - Autonomous AI Negotiation Protocol & PayPal Settlement",
    description:
      "Agents negotiate. Code decides what is allowed. PayPal moves the money. Deterministic, zero-LLM Settlement Kernel enforcing private human mandates.",
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 630,
        alt: "AgentPal Autonomous AI Negotiation Banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentPal - Autonomous AI Negotiation Protocol",
    description:
      "Agents negotiate. Code decides what is allowed. PayPal moves the money. Protected by a deterministic Settlement Kernel.",
    images: ["/banner.png"],
    creator: "@AgentPal",
  },
  category: "technology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-800 font-sans antialiased">
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>
            <div className="flex min-h-screen">
              <SideNav />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          </ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
