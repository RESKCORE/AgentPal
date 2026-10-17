"use client";

import { Lock, ShieldCheck } from "lucide-react";

interface MandateBounds {
  price_min: number;
  price_max: number;
  delivery_days_min: number;
  delivery_days_max: number;
  revisions_min: number;
  revisions_max: number;
  deposit_pct_min: number;
  deposit_pct_max: number;
}

interface SealedMandatesCardProps {
  buyerName?: string;
  sellerName?: string;
  buyerMandate?: MandateBounds | null;
  sellerMandate?: MandateBounds | null;
  viewerRole?: "buyer" | "seller" | null;
  isClosed?: boolean;
}

export function SealedMandatesCard({
  buyerName = "Buyer",
  sellerName = "Seller",
  buyerMandate,
  sellerMandate,
  viewerRole,
  isClosed = false,
}: SealedMandatesCardProps) {
  const canViewBuyer = isClosed || viewerRole === "buyer";
  const canViewSeller = isClosed || viewerRole === "seller";

  return (
    <div className="glass-panel-dark-elevated rounded-3xl p-6 flex flex-col justify-between h-full relative overflow-hidden border border-zinc-200">
      <div>
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-900 flex items-center justify-center shadow-inner">
              <Lock className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="font-outfit font-black text-zinc-900 text-sm tracking-tight">
              Mandate Privacy
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 border border-zinc-200">
              {isClosed ? "Unsealed (Closed)" : "Private Isolation"}
            </span>
          </div>
        </div>

        {/* Mandate Lines */}
        <div className="py-4 space-y-3.5 text-xs">
          {/* Buyer line */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-zinc-700 font-bold">
              <span>Buyer ({buyerName}):</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                canViewBuyer && buyerMandate ? "bg-blue-500/10 text-blue-600 border border-blue-500/30" : "bg-zinc-100 text-zinc-500 border border-zinc-200"
              }`}>
                {canViewBuyer && buyerMandate ? "AUTHORIZED" : "SEALED"}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800">
              {canViewBuyer && buyerMandate ? (
                <div className="font-mono text-xs tabular-nums text-zinc-900 font-bold">
                  ${buyerMandate.price_min}–${buyerMandate.price_max} · {buyerMandate.delivery_days_min}–{buyerMandate.delivery_days_max}d · {buyerMandate.revisions_min}–{buyerMandate.revisions_max} rev · {buyerMandate.deposit_pct_min}–{buyerMandate.deposit_pct_max}%
                </div>
              ) : (
                <div className="font-mono text-xs text-zinc-500 tracking-wider">
                  •••••••••••••••• (Sealed until agreement)
                </div>
              )}
            </div>
          </div>

          {/* Seller line */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-zinc-700 font-bold">
              <span>Seller ({sellerName}):</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                canViewSeller && sellerMandate ? "bg-purple-500/10 text-purple-600 border border-purple-500/30" : "bg-zinc-100 text-zinc-500 border border-zinc-200"
              }`}>
                {canViewSeller && sellerMandate ? "AUTHORIZED" : "SEALED"}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800">
              {canViewSeller && sellerMandate ? (
                <div className="font-mono text-xs tabular-nums text-zinc-900 font-bold">
                  ${sellerMandate.price_min}–${sellerMandate.price_max} · {sellerMandate.delivery_days_min}–{sellerMandate.delivery_days_max}d · {sellerMandate.revisions_min}–{sellerMandate.revisions_max} rev · {sellerMandate.deposit_pct_min}–{sellerMandate.deposit_pct_max}%
                </div>
              ) : (
                <div className="font-mono text-xs text-zinc-500 tracking-wider">
                  •••••••••••••••• (Sealed until agreement)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-200 text-[11px] text-zinc-600 flex items-center gap-2 font-mono">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>Mandates are enforced by Settlement Kernel without exposing limits to counterparty.</span>
      </div>
    </div>
  );
}
