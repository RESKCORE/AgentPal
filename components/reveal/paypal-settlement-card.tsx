"use client";

import { useState } from "react";
import { Check, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPayPalInvoiceUrls } from "@/lib/paypal/executor";

interface PayPalInvoiceData {
  invoiceId?: string;
  invoiceNumber?: string;
  status?: string;
  amount?: number;
  viewUrl?: string;
  invoicerUrl?: string;
  paidAt?: string;
}

interface PayPalSettlementCardProps {
  dealStatus: string;
  paypalInvoice: PayPalInvoiceData | null;
  depositAmount: number;
  depositPct: number;
  totalPrice: number;
  buyerEmail?: string;
  onCreateInvoice: () => Promise<void>;
  onPayInvoice: () => Promise<void>;
  onRefreshStatus?: () => Promise<void>;
  isCreatingInvoice?: boolean;
}

export function PayPalSettlementCard({
  dealStatus,
  paypalInvoice,
  depositAmount,
  depositPct,
  totalPrice,
  buyerEmail,
  onCreateInvoice,
  onPayInvoice,
  onRefreshStatus,
  isCreatingInvoice = false,
}: PayPalSettlementCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isInvoiced = Boolean(paypalInvoice?.invoiceId) || dealStatus === "deposit_invoiced" || dealStatus === "paid";
  const isPaid = paypalInvoice?.status === "PAID" || dealStatus === "paid";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshStatus) {
      await onRefreshStatus();
    }
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const { viewUrl: invoiceUrl, invoicerUrl } = formatPayPalInvoiceUrls(
    paypalInvoice?.invoiceId,
    paypalInvoice?.viewUrl,
    paypalInvoice?.invoicerUrl
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
          PayPal Sandbox settlement
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          <span>Tracking via polling</span>
        </div>
      </div>

      {/* 4-step Stepper Progress Line */}
      <div className="py-2">
        <div className="relative flex items-center justify-between">
          {/* Connecting Line */}
          <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-200 -z-0">
            <div
              className="h-full bg-emerald-600 transition-all duration-500"
              style={{
                width: isPaid ? "66%" : isInvoiced ? "33%" : "0%",
              }}
            />
          </div>

          {/* Step 1: Contract signed */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-emerald-600 text-zinc-900 flex items-center justify-center font-bold text-xs shadow-xs">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 mt-2 text-center">
              Contract signed
            </span>
          </div>

          {/* Step 2: Deposit invoice sent */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-xs ${
                isInvoiced
                  ? "bg-emerald-600 text-zinc-900"
                  : "bg-white border-2 border-slate-300 text-slate-500"
              }`}
            >
              {isInvoiced ? <Check className="h-4 w-4 stroke-[3]" /> : "2"}
            </div>
            <span
              className={`text-[11px] sm:text-xs font-bold mt-2 text-center ${
                isInvoiced ? "text-slate-800" : "text-slate-400"
              }`}
            >
              Deposit invoice sent
            </span>
          </div>

          {/* Step 3: Deposit paid */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-xs ${
                isPaid
                  ? "bg-emerald-600 text-zinc-900"
                  : "bg-white border-2 border-slate-300 text-slate-500"
              }`}
            >
              {isPaid ? <Check className="h-4 w-4 stroke-[3]" /> : "3"}
            </div>
            <span
              className={`text-[11px] sm:text-xs font-bold mt-2 text-center ${
                isPaid ? "text-slate-800" : "text-slate-400"
              }`}
            >
              Deposit paid
            </span>
          </div>

          {/* Step 4: Final invoice */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-white border-2 border-slate-300 text-slate-400 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 mt-2 text-center">
              Final invoice
            </span>
          </div>
        </div>
      </div>

      {/* Actions and Status Bar matching Wireframe 4 */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Buttons: [Create PayPal Sandbox deposit invoice] [Refresh payment status] [Open invoice ↗] */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {!isInvoiced ? (
            <Button
              onClick={onCreateInvoice}
              disabled={isCreatingInvoice}
              className="bg-emerald-600 hover:bg-emerald-700 text-zinc-900 text-xs font-bold h-9 px-4 shadow-xs"
            >
              {isCreatingInvoice ? "Creating PayPal Sandbox Invoice..." : "Create PayPal Sandbox deposit invoice"}
            </Button>
          ) : !isPaid ? (
            <Button
              onClick={onPayInvoice}
              className="bg-emerald-600 hover:bg-emerald-700 text-zinc-900 text-xs font-bold h-9 px-4 shadow-xs"
            >
              Simulate Buyer Paying Deposit (Sandbox)
            </Button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Deposit Paid (${depositAmount.toFixed(2)} USD)</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs h-9 px-3 border-slate-300 hover:bg-slate-50 gap-1.5 text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            <span>Refresh payment status</span>
          </Button>

          {invoiceUrl && (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs h-9 px-3 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 font-semibold"
              title="Open buyer/payer view in PayPal Developer Sandbox"
            >
              <span>Open invoice</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {invoicerUrl && invoicerUrl !== invoiceUrl && (
            <a
              href={invoicerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs h-9 px-3 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 font-semibold"
              title="Open seller/merchant dashboard in PayPal Developer Sandbox"
            >
              <span>Merchant details</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="text-[11px] text-slate-500 text-right sm:ml-auto">
          {isInvoiced && paypalInvoice?.invoiceId && (
            <div className="font-mono">
              Invoice #{paypalInvoice.invoiceId} · <span className="font-semibold">{paypalInvoice.status || "SENT"}</span>
            </div>
          )}
          <div className="text-[10px] text-slate-400">
            {depositPct}% deposit of ${totalPrice.toFixed(2)} USD{buyerEmail ? ` · ${buyerEmail}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
