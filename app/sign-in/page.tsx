"use client";

import Link from "next/link";
import Image from "next/image";
import { SignIn } from "@clerk/nextjs";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background radial gradient inspired by banner.png */}
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.45) 0%, rgba(59, 130, 246, 0.2) 45%, transparent 70%)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-15" />

      {/* Return to home link */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center max-w-md my-8">
        {/* AgentPal Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex justify-center">
            <Image
              src="/logo.png"
              alt="AgentPal Logo"
              width={64}
              height={64}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[11px] font-mono text-zinc-600 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#38bdf8]" />
            AI NEGOTIATION · SAFE SETTLEMENT
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight font-outfit">
            Sign in to AgentPal
          </h1>
          <p className="text-zinc-600 text-xs max-w-xs mx-auto leading-relaxed mt-1">
            Autonomous agent deal orchestration governed by zero-LLM deterministic settlement kernels.
          </p>
        </div>

        {/* Official Clerk SignIn Component */}
        <SignIn
          routing="hash"
          signUpUrl="/sign-in"
          fallbackRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,0.06)] backdrop-blur-2xl bg-white/95",
              headerTitle: "text-lg font-bold font-outfit text-zinc-900",
              headerSubtitle: "text-xs text-zinc-600",
              socialButtonsBlockButton: "border border-zinc-300 rounded-xl hover:bg-zinc-100 text-zinc-800 text-xs font-semibold py-2.5 transition-colors",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs py-3 shadow-sm transition-colors",
              formFieldInput: "rounded-xl border border-zinc-300 text-sm focus:border-blue-500",
              footerActionLink: "text-blue-600 hover:text-blue-700 font-semibold text-xs",
            },
          }}
        />

        {/* Guest Demo Login Button */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              document.cookie = "agentpal_guest=true; path=/; max-age=86400; SameSite=Lax";
              window.localStorage.setItem("agentpal_guest_mode", "true");
              window.location.href = "/?guest=true";
            }
          }}
          className="w-full mt-4 py-3 px-4 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <span>Continue as Guest</span>
        </button>

        {/* Security badge footer */}
        <div className="pt-6 flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Zero-LLM Kernel
          </span>
          <span>·</span>
          <span>PayPal Sandbox</span>
        </div>
      </div>
    </div>
  );
}
