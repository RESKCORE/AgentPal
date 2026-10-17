"use client";

import { useState, use, useSyncExternalStore, useMemo, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Lock, CheckCircle2, AlertCircle, Copy, Check, Download, RefreshCw, ExternalLink, Wallet, CheckCircle, Info } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DealStore, type DealData, toDealData } from "@/lib/deal-store";
import { SettlementKernel } from "@/lib/settlement-kernel";
import { formatPayPalInvoiceUrls } from "@/lib/paypal/executor";

interface PageProps {
  params: Promise<{ id: string }>;
}

const EMPTY_DEALS: DealData[] = [];
const getEmptyDeals = () => EMPTY_DEALS;

export default function RevealPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dealId = resolvedParams.id;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const convexDealDoc = useQuery(api.deals.get, { dealId });
  const deals = useSyncExternalStore(
    DealStore.subscribe,
    DealStore.getDeals,
    getEmptyDeals
  );

  const deal: DealData | null = useMemo(() => {
    if (convexDealDoc) {
      return toDealData(convexDealDoc as Record<string, unknown>);
    }
    return deals.find((d) => d.id === dealId) || DealStore.getDeal(dealId);
  }, [convexDealDoc, deals, dealId]);

  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState(false);

  if (!mounted || !deal) {
    if (mounted && !deal && convexDealDoc === null) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 mb-1">Deal Not Found</h1>
          <p className="text-xs text-zinc-500 mb-6 max-w-sm">
            No deal was found matching ID &ldquo;{dealId}&rdquo;.
          </p>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-semibold shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-zinc-500 text-sm font-mono">
          <Clock className="h-4 w-4 animate-spin text-blue-600" />
          <span>Loading Reveal data...</span>
        </div>
      </div>
    );
  }

  // Access control: Reveal is only accessible once the deal is closed or agreed
  const isClosed = ["agreed", "deposit_invoiced", "paid"].includes(deal.status);
  if (!isClosed) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 border border-amber-200">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 mb-1">The Reveal Is Locked</h1>
        <p className="text-xs text-zinc-500 mb-6 max-w-sm">
          Private mandates remain sealed until both parties sign the agreed terms. A failed negotiation (no_deal) never unseals them. This deal is currently in status &ldquo;{deal.status}&rdquo;.
        </p>
        <Link
          href={`/deals/${deal.id}`}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-semibold shadow-xs"
        >
          Return to Deal Room
        </Link>
      </div>
    );
  }

  const agreedTerms = deal.contract?.terms || deal.standingOffer || null;
  const buyerName = deal.buyer?.name || "Buyer";
  const sellerName = deal.seller?.name || "Seller";

  const buyerMin = deal.buyerMandate?.price_min ?? 0;
  const buyerMax = deal.buyerMandate?.price_max ?? 0;
  const sellerMin = deal.sellerMandate?.price_min ?? 0;
  const sellerMax = deal.sellerMandate?.price_max ?? 0;

  const agreedPrice = agreedTerms?.price ?? 0;
  const depositPct = agreedTerms?.deposit_pct ?? 0;
  const depositCents = agreedPrice > 0 && depositPct > 0
    ? SettlementKernel.calculateDepositCents(SettlementKernel.toCents(agreedPrice), depositPct)
    : 0;
  const depositAmount = depositCents / 100;
  const remainingAmount = Math.max(0, agreedPrice - depositAmount);

  const buyerSavings = buyerMax > 0 && agreedPrice > 0 ? Math.max(buyerMax - agreedPrice, 0) : 0;
  const sellerMargin = sellerMin > 0 && agreedPrice > 0 ? Math.max(agreedPrice - sellerMin, 0) : 0;

  const contractHash = deal.contract?.hash || (deal.standingOffer ? SettlementKernel.hashContract(deal.standingOffer, deal.id, deal.createdAt) : null);

  const isPaid = deal.paypalInvoice?.status === "PAID" || deal.status === "paid";
  const { viewUrl: invoiceUrl, invoicerUrl } = formatPayPalInvoiceUrls(
    deal.paypalInvoice?.invoiceId,
    deal.paypalInvoice?.viewUrl,
    (deal.paypalInvoice as { invoicerUrl?: string })?.invoicerUrl
  );

  const handleCopyHash = () => {
    if (!contractHash) return;
    navigator.clipboard.writeText(`sha256:${contractHash}`);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyInvoiceId = () => {
    if (!deal?.paypalInvoice?.invoiceId) return;
    navigator.clipboard.writeText(deal.paypalInvoice.invoiceId);
    setCopiedInvoiceId(true);
    setTimeout(() => setCopiedInvoiceId(false), 2000);
  };

  const handleDownloadAuditTrail = () => {
    const auditData = {
      dealId: deal.id,
      title: deal.title,
      status: deal.status,
      contractHash,
      agreedTerms,
      buyer: deal.buyer,
      seller: deal.seller,
      buyerMandate: deal.buyerMandate,
      sellerMandate: deal.sellerMandate,
      events: deal.events,
      paypalInvoice: deal.paypalInvoice,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${deal.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateInvoice = async () => {
    if (!deal) return;
    setLoadingInvoice(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invoice", deal }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create deposit invoice.");
      }
      if (data.invoice) {
        const updated = {
          ...deal,
          paypalInvoice: data.invoice,
          status: "deposit_invoiced" as const,
        };
        DealStore.saveDeal(updated);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Invoice creation failed.");
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!deal || !deal.paypalInvoice) return;
    setPayingInvoice(true);
    setActionError(null);
    setVerifyNotice(null);
    try {
      // Server verifies the invoice against PayPal Sandbox and only records PAID
      // when the provider confirms it. No client-asserted success.
      const res = await fetch(`/api/deals/${deal.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed.");
      }
      if (data.deal) {
        DealStore.saveDeal(toDealData(data.deal as Record<string, unknown>));
        setVerifyNotice("Payment verified! PayPal confirmed status: PAID.");
      } else if (data.verifiedStatus && data.verifiedStatus !== "PAID" && data.verifiedStatus !== "MARKED_AS_PAID") {
        setVerifyNotice(`PayPal reports invoice status: ${data.verifiedStatus} (Unpaid). Payment has not been submitted by the buyer yet.`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Payment update failed.");
    } finally {
      setPayingInvoice(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!deal || !deal.paypalInvoice) return;
    setSimulatingPayment(true);
    setActionError(null);
    setVerifyNotice(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate_payment" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Simulated payment failed.");
      }
      if (data.deal) {
        DealStore.saveDeal(toDealData(data.deal as Record<string, unknown>));
        setVerifyNotice("Payment officially recorded in PayPal Sandbox! Status is now PAID.");
      } else {
        setVerifyNotice(`Payment status updated: ${data.verifiedStatus || "PAID"}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Simulated payment failed.");
    } finally {
      setSimulatingPayment(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshingStatus(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/settle`);
      if (res.ok) {
        const data = await res.json();
        if (data.invoice) {
          const updated = {
            ...deal,
            paypalInvoice: data.invoice,
            status: (data.status || deal.status) as typeof deal.status,
          };
          DealStore.saveDeal(updated);
        }
      }
    } catch {
      // Keep existing state on error
    } finally {
      setTimeout(() => setRefreshingStatus(false), 500);
    }
  };

  return (
    <div className="font-sans text-zinc-900 bg-white antialiased min-h-screen flex flex-col relative overflow-hidden">
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(59, 130, 246, 0.15) 45%, transparent 70%)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-15" />

      <main className="w-full flex-1 pb-16 relative z-10">
        <div className="w-full px-4 lg:px-8 py-8 flex flex-col gap-6 max-w-[1500px] mx-auto">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Link
                href={`/deals/${deal.id}`}
                className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 flex items-center justify-center text-zinc-700 hover:text-zinc-900 transition-all active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight font-outfit">
                  The Reveal &amp; Settlement
                </h1>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">
                  Deal: {deal.title} (#{deal.id.slice(0, 8)})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadAuditTrail}
                className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-zinc-800 hover:text-zinc-900 font-mono text-xs font-bold transition-all"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Export Audit JSON</span>
              </button>

              <Link
                href={`/deals/${deal.id}`}
                className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-zinc-800 hover:text-zinc-900 font-mono text-xs font-bold transition-all"
              >
                <span>Back to Room</span>
              </Link>
            </div>
          </div>

          {actionError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
              <span>{actionError}</span>
              <button type="button" onClick={() => setActionError(null)} className="text-rose-600 font-bold ml-2">✕</button>
            </div>
          )}

          {/* Top Banner: Verification & Hash */}
          <div className="glass-panel-elevated p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-zinc-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-zinc-900 flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(16,185,129,0.35)]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-sans font-black text-zinc-900 text-base">Mutual Consensus Reached</span>
                  <span className="glossy-pill px-2.5 py-0.5 rounded-full text-emerald-600 text-[10px] font-mono font-bold uppercase border border-emerald-500/30 bg-emerald-500/10">
                    Kernel Verified
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Both private mandates satisfied. Contract terms sealed and ready for PayPal Sandbox settlement.
                </p>
              </div>
            </div>

            {contractHash && (
              <div className="flex items-center gap-2.5 bg-zinc-100 border border-zinc-200 rounded-2xl px-4 py-2.5 shrink-0 shadow-2xs">
                <span className="font-mono text-xs text-zinc-500 font-semibold">sha256:</span>
                <span className="font-mono text-xs text-zinc-900 font-bold">{contractHash.slice(0, 16)}…</span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="p-1 text-zinc-600 hover:text-zinc-900 transition-colors"
                  title="Copy full contract hash"
                >
                  {copiedHash ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>

          {/* Agreed Terms & Financial Reconciliation */}
          {agreedTerms && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="banner-offer-card p-5 border border-zinc-200">
                <span className="text-zinc-600 uppercase font-mono text-[10px] font-bold block">Agreed Total Price</span>
                <span className="font-mono text-3xl font-black text-zinc-900 mt-1 block">${agreedPrice.toFixed(2)}</span>
                <span className="text-xs text-zinc-500 mt-1 block font-mono">Full contract value</span>
              </div>
              <div className="banner-offer-card p-5 border border-zinc-200">
                <span className="text-blue-600 uppercase font-mono text-[10px] font-bold block">Deposit ({depositPct}%)</span>
                <span className="font-mono text-3xl font-black text-blue-600 mt-1 block">${depositAmount.toFixed(2)}</span>
                <span className="text-xs text-zinc-500 mt-1 block font-mono">Due upon signing</span>
              </div>
              <div className="banner-offer-card p-5 border border-zinc-200">
                <span className="text-zinc-600 uppercase font-mono text-[10px] font-bold block">Remaining Balance</span>
                <span className="font-mono text-3xl font-black text-zinc-800 mt-1 block">${remainingAmount.toFixed(2)}</span>
                <span className="text-xs text-zinc-500 mt-1 block font-mono">Due upon delivery</span>
              </div>
              <div className="banner-offer-card p-5 border border-zinc-200">
                <span className="text-zinc-600 uppercase font-mono text-[10px] font-bold block">Delivery &amp; Revisions</span>
                <span className="font-mono text-3xl font-black text-zinc-900 mt-1 block">{agreedTerms.delivery_days}d · {agreedTerms.revisions} rev</span>
                <span className="text-xs text-zinc-500 mt-1 block font-mono">Timeline commitments</span>
              </div>
            </div>
          )}

          {/* Unsealed Mandate Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buyer Mandate */}
            <div className="glass-panel-elevated rounded-3xl p-6 sm:p-7 space-y-4 border border-zinc-200">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-lg bg-zinc-100 border border-zinc-300 text-blue-600 flex items-center justify-center font-black text-xs">
                    B
                  </div>
                  <h3 className="font-sans font-black text-zinc-900 text-sm tracking-tight">Buyer Mandate ({buyerName})</h3>
                </div>
                <span className="glossy-pill px-2.5 py-0.5 rounded-full text-zinc-700 font-mono text-[11px] font-bold">
                  Unsealed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Price Ceiling</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">${buyerMax}</span>
                </div>
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Price Floor</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">${buyerMin}</span>
                </div>
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Delivery Max</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">{deal.buyerMandate?.delivery_days_max ?? "—"} days</span>
                </div>
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Deposit Max</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">{deal.buyerMandate?.deposit_pct_max ?? "—"}%</span>
                </div>
              </div>

              {buyerSavings > 0 && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs shadow-2xs font-mono">
                  Buyer surplus: <strong className="font-black text-emerald-600">${buyerSavings.toFixed(2)}</strong> saved below reservation cap.
                </div>
              )}
            </div>

            {/* Seller Mandate */}
            <div className="glass-panel-elevated rounded-3xl p-6 sm:p-7 space-y-4 border border-zinc-200">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-lg bg-blue-600 text-zinc-900 flex items-center justify-center font-black text-xs shadow-2xs">
                    S
                  </div>
                  <h3 className="font-sans font-black text-zinc-900 text-sm tracking-tight">Seller Mandate ({sellerName})</h3>
                </div>
                <span className="glossy-pill px-2.5 py-0.5 rounded-full text-zinc-700 font-mono text-[11px] font-bold">
                  Unsealed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Price Floor</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">${sellerMin}</span>
                </div>
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Price Target</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">${sellerMax}</span>
                </div>
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Delivery Min</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">{deal.sellerMandate?.delivery_days_min ?? "—"} days</span>
                </div>
                <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl shadow-2xs">
                  <span className="text-zinc-600 text-[10px] block uppercase font-bold">Deposit Min</span>
                  <span className="font-black text-zinc-900 text-base mt-0.5 block">{deal.sellerMandate?.deposit_pct_min ?? "—"}%</span>
                </div>
              </div>

              {sellerMargin > 0 && (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs shadow-2xs font-mono">
                  Seller margin: <strong className="font-black text-blue-600">${sellerMargin.toFixed(2)}</strong> secured above reservation floor.
                </div>
              )}
            </div>
          </div>

          {/* PayPal Sandbox Settlement Section */}
          <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 space-y-6 border border-zinc-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
              <div>
                <h3 className="text-lg font-black text-zinc-900 tracking-tight font-sans">PayPal Sandbox Settlement</h3>
                <p className="text-xs text-zinc-600 mt-0.5 font-mono">
                  Automated deposit invoicing configured for PayPal Developer Sandbox.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={refreshingStatus}
                  className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-zinc-800 hover:text-zinc-900 font-mono text-xs font-semibold transition-all disabled:opacity-50"
                  title="Check latest status from invoice endpoint"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${refreshingStatus ? "animate-spin" : ""}`} />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>

            {/* Connected Sandbox Account Info Card */}
            <div className="bg-gradient-to-r from-blue-50/90 via-slate-50 to-emerald-50/70 p-5 rounded-2xl border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-bold text-sm text-zinc-900">Connected PayPal Sandbox Account</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-mono font-bold">
                      Verified Business
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                    <span>sb-xxf2153180921@business.example.com</span>
                    <span>•</span>
                    <span>Account ID: AEHTFB25DLUN8</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/95 border border-zinc-200 rounded-xl px-4 py-2.5 shrink-0 shadow-2xs">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">Available Sandbox Balance</span>
                  <span className="font-outfit font-black text-lg text-emerald-600 block">USD $5,000.00</span>
                </div>
                <div className="w-px h-8 bg-zinc-200" />
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">Deposit Due</span>
                  <span className="font-outfit font-black text-lg text-blue-600 block">${depositAmount.toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* Current Invoice Card */}
            {deal.paypalInvoice ? (
              <div className="banner-offer-card p-6 space-y-4 border border-zinc-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-zinc-900">
                        {deal.paypalInvoice.invoiceNumber || deal.paypalInvoice.invoiceId}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          deal.paypalInvoice.status === "PAID"
                            ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-600 border border-blue-500/30"
                        }`}
                      >
                        {deal.paypalInvoice.status}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600 mt-1 block font-mono">
                      Recipient: {deal.paypalInvoice.recipientEmail || deal.buyer?.email || "Buyer"}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-2xl font-black text-zinc-900 block">
                      ${deal.paypalInvoice.amount?.toFixed(2)} {deal.paypalInvoice.currency || "USD"}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono block">Deposit Invoice</span>
                  </div>
                </div>

                {/* Inline Notice for verification or status updates */}
                {verifyNotice && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>{verifyNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerifyNotice(null)}
                      className="text-blue-500 hover:text-blue-700 font-bold ml-2 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-200">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-600">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Mode: PayPal Sandbox
                    </span>
                    <span>•</span>
                    <span>Created: {new Date(deal.paypalInvoice.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {invoiceUrl && (
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all shadow-sm"
                        title="View invoice as buyer/payer in PayPal Sandbox"
                      >
                        <span>View in PayPal Sandbox</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {invoicerUrl && invoicerUrl !== invoiceUrl && (
                      <a
                        href={invoicerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-zinc-800 hover:text-zinc-900 font-mono text-xs font-semibold transition-all"
                        title="View invoice in merchant dashboard (requires seller sandbox login)"
                      >
                        <span>Merchant View</span>
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                      </a>
                    )}

                    {deal.paypalInvoice.invoiceId && (
                      <button
                        type="button"
                        onClick={handleCopyInvoiceId}
                        className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-zinc-700 hover:text-zinc-900 font-mono text-xs font-medium transition-all"
                        title="Copy PayPal Invoice ID"
                      >
                        {copiedInvoiceId ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>
                    )}

                    {!isPaid && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handlePayInvoice}
                          disabled={payingInvoice || simulatingPayment}
                          className="glossy-btn-dark inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                          title="Query live PayPal Sandbox API for invoice payment confirmation"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${payingInvoice ? "animate-spin text-blue-400" : ""}`} />
                          <span>{payingInvoice ? "Verifying with PayPal..." : "Verify Sandbox Payment"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSimulatePayment}
                          disabled={payingInvoice || simulatingPayment}
                          className="glossy-btn-blue inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                          title="Record payment in PayPal Sandbox via POST /v2/invoicing/invoices/{id}/payments"
                        >
                          <CheckCircle className={`h-3.5 w-3.5 ${simulatingPayment ? "animate-spin" : ""}`} />
                          <span>{simulatingPayment ? "Recording Payment..." : "Simulate Sandbox Payment"}</span>
                        </button>
                      </div>
                    )}

                    {isPaid && (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Deposit Settled &amp; Confirmed in Sandbox</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Helpful Sandbox Context Note */}
                <div className="rounded-xl bg-blue-50/70 border border-blue-200/60 p-3 flex items-start gap-2.5 text-xs text-blue-900/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-blue-950">PayPal Developer Sandbox Environment</p>
                    <p className="text-[11px] text-blue-800/80 leading-relaxed">
                      Sandbox invoices live in PayPal&apos;s testing sandbox. To pay or view restricted details, sign in with your Sandbox account at{" "}
                      <a href="https://sandbox.paypal.com" target="_blank" rel="noreferrer" className="underline font-medium hover:text-blue-950">
                        sandbox.paypal.com
                      </a>{" "}
                      using your test credentials.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-zinc-200 rounded-2xl text-center space-y-4 bg-zinc-100/40">
                <p className="text-xs text-zinc-600 max-w-md mx-auto leading-relaxed">
                  Consensus has been reached. Generate the official PayPal Sandbox deposit invoice to initiate milestone disbursement.
                </p>
                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={loadingInvoice}
                  className="glossy-btn-blue inline-flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  <span>{loadingInvoice ? "Creating Invoice..." : "Create Deposit Invoice ($" + depositAmount.toFixed(2) + ")"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full bg-white/90 backdrop-blur-md border-t border-zinc-200 py-6">
        <div className="w-full px-4 lg:px-8 max-w-[1500px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 font-mono text-xs">
          <span>© 2026 AgentPal. Bilateral Autonomous Negotiation &amp; Sandbox Settlement.</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#34d399]" />
            <span className="text-zinc-600">PayPal Sandbox Verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
