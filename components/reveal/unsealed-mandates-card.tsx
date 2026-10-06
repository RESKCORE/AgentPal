"use client";

import { motion } from "framer-motion";
import { Unlock } from "lucide-react";

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

interface UnsealedMandatesCardProps {
  buyerName?: string;
  sellerName?: string;
  buyerMandate?: MandateBounds;
  sellerMandate?: MandateBounds;
}

export function UnsealedMandatesCard({
  buyerName = "Buyer",
  sellerName = "Seller",
  buyerMandate = {
    price_min: 200,
    price_max: 350,
    delivery_days_min: 3,
    delivery_days_max: 5,
    revisions_min: 2,
    revisions_max: 4,
    deposit_pct_min: 10,
    deposit_pct_max: 30,
  },
  sellerMandate = {
    price_min: 250,
    price_max: 400,
    delivery_days_min: 4,
    delivery_days_max: 7,
    revisions_min: 1,
    revisions_max: 2,
    deposit_pct_min: 25,
    deposit_pct_max: 50,
  },
}: UnsealedMandatesCardProps) {
  return (
    <motion.div
      initial={{ filter: "blur(8px)", opacity: 0 }}
      animate={{ filter: "blur(0px)", opacity: 1 }}
      transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
      className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
            <Unlock className="h-4 w-4 text-emerald-600" />
            <span>Unsealed mandates</span>
          </h3>
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
            UNSEALED
          </span>
        </div>

        <div className="space-y-2.5 text-xs sm:text-sm font-medium text-slate-800 tabular-nums">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
            <span className="font-bold text-slate-900">{buyerName}</span>
            <span className="font-mono text-slate-700">
              ${buyerMandate.price_min}–${buyerMandate.price_max} · {buyerMandate.delivery_days_min}–{buyerMandate.delivery_days_max}d · {buyerMandate.revisions_min}–{buyerMandate.revisions_max} rev · {buyerMandate.deposit_pct_min}–{buyerMandate.deposit_pct_max}%
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
            <span className="font-bold text-slate-900">{sellerName}</span>
            <span className="font-mono text-slate-700">
              ${sellerMandate.price_min}–${sellerMandate.price_max} · {sellerMandate.delivery_days_min}–{sellerMandate.delivery_days_max}d · {sellerMandate.revisions_min}–{sellerMandate.revisions_max} rev · {sellerMandate.deposit_pct_min}–{sellerMandate.deposit_pct_max}%
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Both parties revealed post-agreement</span>
        <span className="font-mono text-slate-400">Zero Leakage During Turns</span>
      </div>
    </motion.div>
  );
}
