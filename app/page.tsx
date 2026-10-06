"use client";

import { useSyncExternalStore, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DealStore, type DealData, toDealData } from "@/lib/deal-store";

const EMPTY_DEALS: DealData[] = [];
const getEmptyDeals = () => EMPTY_DEALS;

export default function HomePage() {
  const convexDeals = useQuery(api.deals.list);
  const localDeals = useSyncExternalStore(
    DealStore.subscribe,
    DealStore.getDeals,
    getEmptyDeals
  );

  // Filter tabs: "all" | "active" | "agreed" | "closed"
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "agreed" | "closed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Authorized deals source of truth (Convex cloud with fallback to local client store)
  const deals: DealData[] = useMemo(() => {
    if (convexDeals && convexDeals.length > 0) {
      return (convexDeals as Record<string, unknown>[]).map(toDealData);
    }
    return localDeals;
  }, [convexDeals, localDeals]);

  // Dynamic statistics calculated strictly from real deals
  const activeNegotiations = deals.filter(
    (d) => d.status === "open" || d.status === "tentative_agreement"
  ).length;
  const agreementsReached = deals.filter((d) =>
    ["agreed", "deposit_invoiced", "paid"].includes(d.status)
  ).length;
  const closedCount = deals.filter((d) => ["paid", "no_deal"].includes(d.status)).length;
  const paidDeals = deals.filter(
    (d) => d.status === "paid" || d.paypalInvoice?.status === "PAID"
  );
  const settledAmount = paidDeals.reduce((acc, d) => {
    if (d.paypalInvoice?.amount) return acc + d.paypalInvoice.amount;
    return acc;
  }, 0);

  // Filter by status tab & search query
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (statusFilter === "active" && d.status !== "open" && d.status !== "tentative_agreement") return false;
      if (statusFilter === "agreed" && d.status !== "agreed" && d.status !== "deposit_invoiced") return false;
      if (statusFilter === "closed" && d.status !== "paid" && d.status !== "no_deal") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = d.title.toLowerCase().includes(q);
        const idMatch = d.id.toLowerCase().includes(q);
        const buyerMatch = (d.buyer?.name || "buyer").toLowerCase().includes(q);
        const sellerMatch = (d.seller?.name || "seller").toLowerCase().includes(q);
        return titleMatch || idMatch || buyerMatch || sellerMatch;
      }
      return true;
    });
  }, [deals, statusFilter, searchQuery]);

  return (
    <div className="bg-[#F8FAFC] font-sans text-slate-800 antialiased min-h-screen flex flex-col">
      <main className="w-full bg-[#F8FAFC] flex-1 pb-8">
        <div className="w-full px-4 lg:px-8 py-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
          {/* Top Title & Action Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-white border border-slate-200 text-emerald-700 font-mono text-xs tracking-wider uppercase font-semibold">
                  PayPal Sandbox Mode
                </span>
                <span className="text-slate-300 font-mono text-xs">/</span>
                <span className="text-slate-500 font-mono text-xs">Deterministic Kernel Enforced</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-950 p-1.5 shadow-sm border border-slate-800 flex items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt="AgentPal Logo"
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                    priority
                  />
                </div>
                <h1 className="text-3xl lg:text-4xl text-slate-900 tracking-tight font-extrabold">
                  Agent Negotiations
                </h1>
              </div>
              <p className="text-sm md:text-base text-slate-500">
                Bilateral 1:1 negotiation rooms, private mandate bounds, and verified sandbox settlement.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Link
                href="/deals/new"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs font-mono transition-all duration-200 shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>+ New deal</span>
              </Link>
            </div>
          </div>

          {/* Honest Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric 1: Active Negotiations */}
            <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-5 shadow-xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Active Negotiations
                </span>
                <span className="flex h-2.5 w-2.5 relative items-center justify-center">
                  {activeNegotiations > 0 ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300" />
                  )}
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-mono text-4xl text-slate-900 font-bold tracking-tight">
                  {activeNegotiations}
                </span>
                <span className="font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded font-medium">
                  {activeNegotiations > 0 ? "In Progress" : "Idle"}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>{activeNegotiations === 1 ? "1 active room" : `${activeNegotiations} active rooms`}</span>
                <span className="font-mono text-xs text-slate-400">Total: {deals.length} deals</span>
              </div>
            </div>

            {/* Metric 2: Agreements Reached */}
            <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-5 shadow-xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Agreements Reached
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-mono text-4xl text-slate-900 font-bold tracking-tight">
                  {agreementsReached}
                </span>
                <span className="font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded font-medium">
                  Consensus
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  {deals.length > 0
                    ? `${Math.round((agreementsReached / deals.length) * 100)}% agreement rate`
                    : "No deals recorded"}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {agreementsReached} of {deals.length} closed
                </span>
              </div>
            </div>

            {/* Metric 3: Settled (Sandbox USD) */}
            <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-5 shadow-xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Settled Deposits (Sandbox)
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-mono text-4xl text-slate-900 font-bold tracking-tight">
                  ${settledAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded font-medium">
                  USD Sandbox
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  {paidDeals.length === 1
                    ? "1 paid deposit"
                    : `${paidDeals.length} paid deposits`}
                </span>
                <span className="font-mono text-xs text-slate-400">PayPal Invoicing</span>
              </div>
            </div>
          </div>

          {/* Deals Table Management Panel */}
          <div id="deals" className="flex flex-col rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Controls Bar */}
            <div className="p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50/80 border-b border-slate-200">
              {/* Filter Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
                      statusFilter === "all"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    All ({deals.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("active")}
                    className={`px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
                      statusFilter === "active"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    Active ({activeNegotiations})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("agreed")}
                    className={`px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
                      statusFilter === "agreed"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    Agreed ({agreementsReached})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("closed")}
                    className={`px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
                      statusFilter === "closed"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    Closed ({closedCount})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter by deal title or participant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-mono text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-5 font-semibold">Deal Title &amp; Details</th>
                    <th className="py-3.5 px-4 font-semibold">Participants</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Rounds</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Latest Standing Offer</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Payment State</th>
                    <th className="py-3.5 px-5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-sm text-slate-800">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 px-5 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-slate-500">
                          <span className="material-symbols-outlined text-[36px] text-slate-300">
                            handshake
                          </span>
                          <span className="font-semibold text-slate-700 text-sm">
                            {deals.length === 0 ? "No negotiation deals found" : "No deals match your search"}
                          </span>
                          <p className="text-xs text-slate-400 text-center">
                            {deals.length === 0
                              ? "Create a deal room to define private mandates and begin bilateral negotiation."
                              : "Try clearing your filters or changing search keywords."}
                          </p>
                          {deals.length === 0 && (
                            <Link
                              href="/deals/new"
                              className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold shadow-xs transition-colors"
                            >
                              + Create New Deal
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map((deal) => {
                      const roundCount = deal.events?.filter((e) => e.type === "offer").length ?? 0;
                      const maxRounds = deal.maxRounds || 6;
                      const price = deal.standingOffer?.price ?? deal.contract?.terms?.price ?? null;
                      const isClosed = ["agreed", "deposit_invoiced", "paid"].includes(deal.status);
                      const paymentState =
                        deal.paypalInvoice?.status === "PAID" || deal.status === "paid"
                          ? "Paid"
                          : deal.paypalInvoice?.status === "SENT" || deal.status === "deposit_invoiced"
                          ? "Invoiced"
                          : "—";

                      const buyerDisplayName = deal.buyer?.name || "Buyer";
                      const sellerDisplayName = deal.seller?.name || "Seller";

                      return (
                        <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* Deal Name & Context */}
                          <td className="py-4 px-5">
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                  {deal.title}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs">
                                  #{deal.id.slice(0, 8)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 text-xs truncate max-w-xs">
                                  {deal.description || "Bilateral 1:1 negotiation room"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Participants */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 font-mono text-xs">
                              <div className="flex items-center gap-1.5 text-slate-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="font-semibold text-slate-900">{buyerDisplayName}</span>
                                <span className="text-slate-400">(Buyer)</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span className="font-medium text-slate-800">{sellerDisplayName}</span>
                                <span className="text-slate-400">(Seller)</span>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {deal.status === "open" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-xs font-semibold">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                </span>
                                Negotiating
                              </span>
                            ) : deal.status === "tentative_agreement" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-mono text-xs font-semibold">
                                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                Awaiting Signatures
                              </span>
                            ) : deal.status === "agreed" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-xs font-semibold">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                Agreed
                              </span>
                            ) : deal.status === "deposit_invoiced" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-semibold">
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                Invoiced
                              </span>
                            ) : deal.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold">
                                <span className="material-symbols-outlined text-[14px]">done_all</span>
                                Paid
                              </span>
                            ) : deal.status === "no_deal" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs font-semibold">
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                                No Deal
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                                Setup
                              </span>
                            )}
                          </td>

                          {/* Rounds */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs text-slate-700">
                              {roundCount} / {maxRounds}
                            </span>
                          </td>

                          {/* Latest Standing Offer */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm font-bold text-slate-900">
                                {price != null ? `$${price}` : "—"}
                              </span>
                              <span className="font-mono text-xs text-slate-400">
                                {price != null ? (isClosed ? "Final Terms" : "Current Bid") : "No offers yet"}
                              </span>
                            </div>
                          </td>

                          {/* Payment State */}
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {paymentState === "Invoiced" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-medium">
                                <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                                Invoiced
                              </span>
                            ) : paymentState === "Paid" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-xs font-semibold">
                                <span className="material-symbols-outlined text-[12px]">payments</span>
                                Paid
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-slate-400 font-medium">—</span>
                            )}
                          </td>

                          {/* Action CTA */}
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            {isClosed ? (
                              <Link
                                href={`/deals/${deal.id}/reveal`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-mono text-xs font-semibold transition-colors"
                              >
                                <span>View Reveal</span>
                                <span className="material-symbols-outlined text-[15px]">visibility</span>
                              </Link>
                            ) : (
                              <Link
                                href={`/deals/${deal.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-semibold transition-colors shadow-2xs"
                              >
                                <span>Open Room</span>
                                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 font-mono text-xs">
              <span>Displaying {filteredDeals.length} of {deals.length} deals</span>
              <span className="text-slate-400">Deterministic Kernel Verification Active</span>
            </div>
          </div>

          {/* System Architecture Overview Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">shield</span>
                <span>Deterministic Kernel</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Offers and acceptances must strictly satisfy each participant&apos;s private mandate bounds before entering the event log.
              </p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">lock</span>
                <span>Dual-Party Privacy</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mandates remain private to each participant. Both mandates unseal only upon mutual consensus or deal closing.
              </p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                <span>PayPal Sandbox Settlement</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Agreed contracts trigger automated deposit and balance invoicing through the PayPal Sandbox API.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full bg-white border-t border-slate-200 py-6">
        <div className="w-full px-4 lg:px-8 max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 font-mono text-xs">
          <span>© 2026 AgentPal. Bilateral Autonomous Negotiation &amp; Sandbox Settlement.</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Environment: Sandbox
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
