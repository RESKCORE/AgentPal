"use client";

import { useState, use, useSyncExternalStore, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Lock, CheckCircle2, AlertCircle, Copy, Check, Download, RefreshCw, ExternalLink } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DealStore, type DealData, toDealData } from "@/lib/deal-store";
import { SettlementKernel } from "@/lib/settlement-kernel";

interface PageProps {
  params: Promise<{ id: string }>;
}

const EMPTY_DEALS: DealData[] = [];
const getEmptyDeals = () => EMPTY_DEALS;

export default function RevealPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dealId = resolvedParams.id;

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
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!deal && convexDealDoc === null) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Deal Not Found</h1>
        <p className="text-xs text-slate-500 mb-6 max-w-sm">
          No deal was found matching ID &ldquo;{dealId}&rdquo;.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold shadow-xs"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-mono">
          <Clock className="h-4 w-4 animate-spin text-emerald-600" />
          <span>Loading Reveal data...</span>
        </div>
      </div>
    );
  }

  // Access control: Reveal is only accessible once the deal is closed or agreed
  const isClosed = ["agreed", "deposit_invoiced", "paid"].includes(deal.status);
  if (!isClosed) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 border border-amber-200">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">The Reveal Is Locked</h1>
        <p className="text-xs text-slate-500 mb-6 max-w-sm">
          Private mandates remain sealed until both parties sign the agreed terms. A failed negotiation (no_deal) never unseals them. This deal is currently in status &ldquo;{deal.status}&rdquo;.
        </p>
        <Link
          href={`/deals/${deal.id}`}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold shadow-xs"
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
  const invoiceUrl =
    deal.paypalInvoice?.viewUrl ||
    (deal.paypalInvoice?.invoiceId && !deal.paypalInvoice.invoiceId.startsWith("pending")
      ? `https://www.sandbox.paypal.com/invoice/p/#${deal.paypalInvoice.invoiceId}`
      : null);

  const handleCopyHash = () => {
    if (!contractHash) return;
    navigator.clipboard.writeText(`sha256:${contractHash}`);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
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
      } else if (data.verifiedStatus && data.verifiedStatus !== "PAID" && data.verifiedStatus !== "MARKED_AS_PAID") {
        setActionError(`PayPal reports invoice status: ${data.verifiedStatus}. Not marked paid.`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Payment update failed.");
    } finally {
      setPayingInvoice(false);
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
    <div className="bg-[#F8FAFC] font-sans text-slate-800 antialiased min-h-screen flex flex-col">
      <main className="w-full bg-[#F8FAFC] flex-1 pb-8">
        <div className="w-full px-4 lg:px-8 py-8 flex flex-col gap-6 max-w-[1500px] mx-auto">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/deals/${deal.id}`}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 shadow-xs transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  The Reveal &amp; Settlement
                </h1>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Deal: {deal.title} (#{deal.id.slice(0, 8)})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadAuditTrail}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-mono text-xs font-semibold shadow-2xs transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Audit JSON</span>
              </button>

              <Link
                href={`/deals/${deal.id}`}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-semibold transition-colors"
              >
                <span>Back to Room</span>
              </Link>
            </div>
          </div>

          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <span>{actionError}</span>
              <button type="button" onClick={() => setActionError(null)} className="text-rose-600 font-bold ml-2">✕</button>
            </div>
          )}

          {/* Top Banner: Verification & Hash */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">Mutual Consensus Reached</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold uppercase">
                    Kernel Verified
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Both private mandates satisfied. Contract terms sealed and ready for PayPal Sandbox settlement.
                </p>
              </div>
            </div>

            {contractHash && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-2 shrink-0">
                <span className="font-mono text-xs text-slate-400">sha256:</span>
                <span className="font-mono text-xs text-slate-800 font-semibold">{contractHash.slice(0, 16)}…</span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Copy full contract hash"
                >
                  {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Agreed Terms & Financial Reconciliation */}
          {agreedTerms && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">Agreed Total Price</span>
                <span className="font-mono text-2xl font-bold text-slate-900 mt-1 block">${agreedPrice.toFixed(2)}</span>
                <span className="text-[11px] text-slate-500 mt-1 block">Full contract value</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">Deposit ({depositPct}%)</span>
                <span className="font-mono text-2xl font-bold text-emerald-700 mt-1 block">${depositAmount.toFixed(2)}</span>
                <span className="text-[11px] text-slate-500 mt-1 block">Due upon signing</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">Remaining Balance</span>
                <span className="font-mono text-2xl font-bold text-slate-700 mt-1 block">${remainingAmount.toFixed(2)}</span>
                <span className="text-[11px] text-slate-500 mt-1 block">Due upon delivery</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">Delivery &amp; Revisions</span>
                <span className="font-mono text-2xl font-bold text-slate-900 mt-1 block">{agreedTerms.delivery_days}d · {agreedTerms.revisions} rev</span>
                <span className="text-[11px] text-slate-500 mt-1 block">Timeline commitments</span>
              </div>
            </div>
          )}

          {/* Unsealed Mandate Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buyer Mandate */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h3 className="font-bold text-slate-900 text-sm">Buyer Mandate ({buyerName})</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[11px] font-semibold">
                  Unsealed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Price Ceiling</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">${buyerMax}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Price Floor</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">${buyerMin}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Delivery Max</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{deal.buyerMandate?.delivery_days_max ?? "—"} days</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Deposit Max</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{deal.buyerMandate?.deposit_pct_max ?? "—"}%</span>
                </div>
              </div>

              {buyerSavings > 0 && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs">
                  Buyer surplus: <strong className="font-mono">${buyerSavings.toFixed(2)}</strong> saved below reservation cap.
                </div>
              )}
            </div>

            {/* Seller Mandate */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <h3 className="font-bold text-slate-900 text-sm">Seller Mandate ({sellerName})</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                  Unsealed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Price Floor</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">${sellerMin}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Price Target</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">${sellerMax}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Delivery Min</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{deal.sellerMandate?.delivery_days_min ?? "—"} days</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">Deposit Min</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{deal.sellerMandate?.deposit_pct_min ?? "—"}%</span>
                </div>
              </div>

              {sellerMargin > 0 && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs">
                  Seller margin: <strong className="font-mono">${sellerMargin.toFixed(2)}</strong> secured above reservation floor.
                </div>
              )}
            </div>
          </div>

          {/* PayPal Sandbox Settlement Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">PayPal Sandbox Settlement</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated deposit invoicing configured for PayPal Developer Sandbox.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={refreshingStatus}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-mono text-xs transition-colors disabled:opacity-50"
                  title="Check latest status from invoice endpoint"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingStatus ? "animate-spin" : ""}`} />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>

            {/* Current Invoice Card */}
            {deal.paypalInvoice ? (
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {deal.paypalInvoice.invoiceNumber || deal.paypalInvoice.invoiceId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          deal.paypalInvoice.status === "PAID"
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {deal.paypalInvoice.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Recipient: {deal.paypalInvoice.recipientEmail || deal.buyer?.email || "Buyer"}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-xl font-bold text-slate-900">
                      ${deal.paypalInvoice.amount?.toFixed(2)} {deal.paypalInvoice.currency || "USD"}
                    </span>
                    <span className="text-[11px] text-slate-400 block">Deposit Invoice</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                    <span>Mode: PayPal Sandbox</span>
                    <span>•</span>
                    <span>Created: {new Date(deal.paypalInvoice.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {invoiceUrl && (
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-mono text-xs font-semibold shadow-2xs transition-colors"
                      >
                        <span>View in PayPal Sandbox</span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </a>
                    )}

                    {!isPaid && (
                      <button
                        type="button"
                        onClick={handlePayInvoice}
                        disabled={payingInvoice}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <span>{payingInvoice ? "Verifying..." : "Verify Sandbox Payment"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-3">
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Consensus has been reached. Generate the official PayPal Sandbox deposit invoice to initiate milestone disbursement.
                </p>
                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={loadingInvoice}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  <span>{loadingInvoice ? "Creating Invoice..." : "Create Deposit Invoice ($" + depositAmount.toFixed(2) + ")"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full bg-white border-t border-slate-200 py-6">
        <div className="w-full px-4 lg:px-8 max-w-[1500px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 font-mono text-xs">
          <span>© 2026 AgentPal. Bilateral Autonomous Negotiation &amp; Sandbox Settlement.</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>PayPal Sandbox Verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
