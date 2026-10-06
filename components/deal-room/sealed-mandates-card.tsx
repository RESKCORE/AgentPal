"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full relative overflow-hidden">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-700" />
            <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
              Mandate Privacy
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] bg-white border-slate-300 text-slate-600 font-medium">
              {isClosed ? "Unsealed (Closed)" : "Private Isolation"}
            </Badge>
          </div>
        </div>

        {/* Mandate Lines */}
        <div className="py-4 space-y-3.5 text-xs">
          {/* Buyer line */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-slate-600 font-bold">
              <span>Buyer ({buyerName}):</span>
              <span className="text-[10px] font-mono text-slate-400">
                {canViewBuyer && buyerMandate ? "AUTHORIZED" : "SEALED"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700">
              {canViewBuyer && buyerMandate ? (
                <div className="font-mono text-[11px] tabular-nums text-slate-900 font-medium">
                  ${buyerMandate.price_min}–${buyerMandate.price_max} · {buyerMandate.delivery_days_min}–{buyerMandate.delivery_days_max}d · {buyerMandate.revisions_min}–{buyerMandate.revisions_max} rev · {buyerMandate.deposit_pct_min}–{buyerMandate.deposit_pct_max}%
                </div>
              ) : (
                <div className="font-mono text-xs text-slate-400 italic">
                  •••••••••••••••• (Sealed until agreement)
                </div>
              )}
            </div>
          </div>

          {/* Seller line */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-slate-600 font-bold">
              <span>Seller ({sellerName}):</span>
              <span className="text-[10px] font-mono text-slate-400">
                {canViewSeller && sellerMandate ? "AUTHORIZED" : "SEALED"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700">
              {canViewSeller && sellerMandate ? (
                <div className="font-mono text-[11px] tabular-nums text-slate-900 font-medium">
                  ${sellerMandate.price_min}–${sellerMandate.price_max} · {sellerMandate.delivery_days_min}–{sellerMandate.delivery_days_max}d · {sellerMandate.revisions_min}–{sellerMandate.revisions_max} rev · {sellerMandate.deposit_pct_min}–{sellerMandate.deposit_pct_max}%
                </div>
              ) : (
                <div className="font-mono text-xs text-slate-400 italic">
                  •••••••••••••••• (Sealed until agreement)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-slate-100/70 border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>Mandates are enforced by the Settlement Kernel without exposing limits to the counterparty.</span>
      </div>
    </div>
  );
}
