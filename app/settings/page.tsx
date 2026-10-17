"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Check, LogOut, User, ShieldCheck, Mail, ArrowUpRight } from "lucide-react";

const KEYS = {
  name: "agentpal_profile_name",
  buyerEmail: "agentpal_buyer_paypal_email",
  sellerEmail: "agentpal_seller_paypal_email",
};

export default function SettingsPage() {
  const router = useRouter();
  const viewer = useQuery(api.deals.viewer);
  const { signOut } = useClerk();
  const { user } = useUser();

  const [name, setName] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(KEYS.name) ?? "" : ""));
  const [buyerEmail, setBuyerEmail] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(KEYS.buyerEmail) ?? "" : ""));
  const [sellerEmail, setSellerEmail] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(KEYS.sellerEmail) ?? "" : ""));
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSave = () => {
    window.localStorage.setItem(KEYS.name, name.trim());
    window.localStorage.setItem(KEYS.buyerEmail, buyerEmail.trim());
    window.localStorage.setItem(KEYS.sellerEmail, sellerEmail.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      router.push("/sign-in");
    } finally {
      setSigningOut(false);
    }
  };

  const inputClass =
    "w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans transition-all";

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans relative overflow-hidden">
      {/* Ambient gradient */}
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(59, 130, 246, 0.15) 45%, transparent 70%)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-15" />

      <main className="container mx-auto px-4 sm:px-6 py-8 pb-16 max-w-3xl space-y-8 flex-1 relative z-10">
        {/* Header section with architectural kicker */}
        <div className="border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[11px] font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
            Configuration · Identity & Invoicing
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 font-outfit">
            Account Settings
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Manage your session identity, autonomous negotiation persona, and default PayPal Sandbox addresses.
          </p>
        </div>

        {/* Authenticated Account Card */}
        <div className="glass-panel-dark-elevated rounded-3xl p-6 border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-blue-600 flex items-center justify-center font-bold shadow-inner">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-base font-outfit">Active Identity</h3>
                <span className="text-xs text-zinc-600 font-mono flex items-center gap-2 mt-0.5">
                  <span>{viewer?.email || user?.primaryEmailAddress?.emailAddress || "Authenticated Clerk User"}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 text-[10px] font-semibold">
                    Authorized
                  </span>
                </span>
                {(viewer?.name || user?.fullName) && (
                  <span className="block text-xs text-zinc-500 mt-0.5">{viewer?.name || user?.fullName}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-xs font-semibold h-9 px-4 rounded-xl border border-rose-500/30 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-600 pt-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Cryptographic signatures will be signed with this verified session token.</span>
          </div>
        </div>

        {/* Profile & Invoicing Defaults Card */}
        <div className="glass-panel-dark-elevated rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6">
          <div className="border-b border-zinc-200 pb-4">
            <h3 className="font-bold text-zinc-900 text-lg font-outfit">
              Negotiation Profile &amp; PayPal Invoicing
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              These defaults pre-fill your buyer or seller mandate parameters when launching new deal rooms.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="settings-name" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2 font-mono">
                Agent Operator Display Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                placeholder={viewer?.name || "e.g. Alex (Engineering Lead)"}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Shown to counterparty agents during bilateral deal initiation.
              </p>
            </div>

            <div>
              <label htmlFor="settings-buyer-email" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2 font-mono">
                Buyer PayPal Email (Sandbox)
              </label>
              <input
                id="settings-buyer-email"
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="buyer@sandbox.example.com"
                className={inputClass}
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Deposit escrow invoices are dispatched here when you act as the buying principal.
              </p>
            </div>

            <div>
              <label htmlFor="settings-seller-email" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2 font-mono">
                Seller Payout Email (Sandbox)
              </label>
              <input
                id="settings-seller-email"
                type="email"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                placeholder="seller@sandbox.example.com"
                className={inputClass}
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Designated payout and invoice creator address when you act as the selling principal.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 flex items-center justify-between">
            <div className="text-[11px] text-zinc-500 font-mono">
              Saved locally to your browser storage
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="glossy-btn-blue text-xs font-bold h-10 rounded-xl px-6 flex items-center gap-2"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Settings Saved</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
