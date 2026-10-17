"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, PenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DealData } from "@/lib/deal-store";

type Role = "buyer" | "seller";

interface TentativeAgreementCardProps {
  deal: DealData;
  myRole: Role | null;
  onConfirm: (role: Role) => void;
  onAdjust: (role: Role, feedback: string) => void;
  busy?: boolean;
}

function SignatureChip({
  label,
  signed,
  at,
}: {
  label: string;
  signed: boolean;
  at?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
        signed
          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
          : "bg-slate-50 border-slate-200 text-slate-500"
      }`}
    >
      {signed ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Clock className="h-4 w-4 text-slate-400" />
      )}
      <span>
        {label}:{" "}
        {signed
          ? `Signed${at ? ` · ${new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`
          : "Awaiting signature"}
      </span>
    </div>
  );
}

export function TentativeAgreementCard({
  deal,
  myRole,
  onConfirm,
  onAdjust,
  busy = false,
}: TentativeAgreementCardProps) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const terms = deal.tentativeTerms ?? deal.standingOffer;
  if (!terms) return null;

  const depositAmount = Math.round((terms.price * terms.deposit_pct) / 100);
  const iSigned = myRole ? deal.confirmations[myRole] : false;
  const bothSigned = deal.confirmations.buyer && deal.confirmations.seller;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-400 text-zinc-900 flex items-center justify-center shrink-0">
          <PenLine className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-extrabold text-amber-950 text-sm sm:text-base">
            Tentative agreement — awaiting both signatures
          </h3>
          <p className="text-xs text-amber-800 mt-0.5">
            Agents proposed these terms. Nothing is binding until both humans confirm.
          </p>
        </div>
      </div>

      {/* Terms breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { label: "Price", value: `$${terms.price}` },
          { label: "Delivery", value: `${terms.delivery_days} days` },
          { label: "Revisions", value: `${terms.revisions}` },
          { label: "Deposit", value: `${terms.deposit_pct}%` },
          { label: "Deposit amount", value: `$${depositAmount}` },
        ].map((t) => (
          <div key={t.label} className="bg-white/80 border border-amber-200 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">{t.label}</p>
            <p className="text-sm font-black text-slate-900 font-mono tabular-nums mt-0.5">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Signature checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <SignatureChip label="Buyer" signed={deal.confirmations.buyer} at={deal.confirmations.buyerConfirmedAt} />
        <SignatureChip label="Seller" signed={deal.confirmations.seller} at={deal.confirmations.sellerConfirmedAt} />
      </div>

      {/* Actions */}
      {myRole && !bothSigned && (
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button
            type="button"
            disabled={busy || iSigned}
            onClick={() => onConfirm(myRole)}
            className="bg-emerald-600 hover:bg-emerald-700 text-zinc-900 text-xs font-bold h-9 rounded-xl px-4 gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {iSigned ? "You signed — waiting on counterparty" : `Confirm & sign as ${myRole}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setAdjustOpen(true)}
            className="border-amber-400 text-amber-900 hover:bg-amber-100 text-xs font-semibold h-9 rounded-xl px-4 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Request adjustment
          </Button>
        </div>
      )}

      {/* Adjustment dialog */}
      <AnimatePresence>
        {adjustOpen && myRole && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/80 border border-amber-200 rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold text-amber-900 block">
                What should the agents change?
              </label>
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Lower the deposit to 20% and shave $20 off the price."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!feedback.trim() || busy}
                  onClick={() => {
                    onAdjust(myRole, feedback.trim());
                    setAdjustOpen(false);
                    setFeedback("");
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-900 text-xs font-bold"
                >
                  Send agents back to negotiate
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
