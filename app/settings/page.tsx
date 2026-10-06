"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Check, LogOut, User } from "lucide-react";

const KEYS = {
  name: "agentpal_profile_name",
  buyerEmail: "agentpal_buyer_paypal_email",
  sellerEmail: "agentpal_seller_paypal_email",
};

export default function SettingsPage() {
  const router = useRouter();
  const viewer = useQuery(api.deals.viewer);
  const { signOut } = useAuthActions();

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
      await signOut();
      router.push("/sign-in");
    } catch {
      setSigningOut(false);
    }
  };

  const field =
    "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      <main className="container mx-auto px-4 sm:px-6 py-8 pb-8 max-w-2xl space-y-6 flex-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Settings</h1>
          <p className="text-xs text-slate-500 mt-1">Account authentication, profile, and PayPal Sandbox emails.</p>
        </div>

        {/* Authenticated Account Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Authenticated Account</h3>
                <span className="text-xs text-slate-500 font-mono">
                  {viewer ? (viewer.email || "Email not provided") : "Guest / Local Session"}
                  {viewer?.name && (
                    <span className="block text-slate-400">{viewer.name}</span>
                  )}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-xs font-semibold h-8 px-3 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </Button>
          </div>
        </div>

        {/* Profile & Invoicing Defaults Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
            Negotiation Profile &amp; PayPal Invoicing
          </h3>

          <div>
            <label htmlFor="settings-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Display name
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              placeholder={viewer?.name || "Your name"}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="settings-buyer-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Buyer PayPal email (Sandbox)
            </label>
            <input
              id="settings-buyer-email"
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="buyer@sandbox.example.com"
              className={field}
            />
            <p className="text-[11px] text-slate-400 mt-1">Deposit invoices are dispatched here when you act as the buyer.</p>
          </div>

          <div>
            <label htmlFor="settings-seller-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Seller payout email (Sandbox)
            </label>
            <input
              id="settings-seller-email"
              type="email"
              value={sellerEmail}
              onChange={(e) => setSellerEmail(e.target.value)}
              placeholder="seller@sandbox.example.com"
              className={field}
            />
            <p className="text-[11px] text-slate-400 mt-1">Payout and invoice creator address when you act as the seller.</p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 rounded-xl px-5 gap-1.5"
            >
              {saved && <Check className="h-3.5 w-3.5" />}
              {saved ? "Saved" : "Save settings"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
