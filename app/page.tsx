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
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans relative overflow-hidden">
      {/* Background radial gradient inspired by banner.png */}
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(59, 130, 246, 0.15) 45%, transparent 70%)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-15" />

      <main className="w-full flex-1 pb-16 relative z-10">
        <div className="w-full px-4 lg:px-8 py-8 flex flex-col gap-8 max-w-[1600px] mx-auto">

          {/* ========================================================
              CINEMATIC HERO SHOWCASE — Inspired by Banner & Logo
              ======================================================== */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-10 border border-zinc-200 glass-panel-dark-elevated shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
            {/* Ambient specular light spots */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-96 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="pointer-events-none absolute top-12 right-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-2xl" />

            <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
              
              {/* Top Status Capsule Pill */}
              <div className="flex items-center gap-2 flex-wrap justify-center mb-5">
                <div className="px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#34d399]" />
                  </span>
                  <span>PayPal Sandbox Protocol</span>
                </div>
                <span className="text-zinc-600 font-mono text-xs">•</span>
                <div className="px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-600 bg-zinc-100 border border-zinc-200">
                  <span className="material-symbols-outlined text-[14px] text-blue-600">verified_user</span>
                  <span>Deterministic Kernel Enforced</span>
                </div>
              </div>

              {/* Central Logo & Brand Typography (Raw PNG without borders/backgrounds) */}
              <div className="flex flex-col items-center gap-2 mb-4">
                <div className="mb-2 flex justify-center">
                  <Image
                    src="/logo.png"
                    alt="AgentPal Logo"
                    width={88}
                    height={88}
                    className="h-16 sm:h-20 w-auto object-contain"
                    priority
                  />
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-900 tracking-tight font-outfit">
                  AgentPal
                </h1>

                <div className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-[0.28em] uppercase text-zinc-600 font-bold">
                  <span>AI Negotiation</span>
                  <span className="text-blue-600 font-black">•</span>
                  <span>Safe Settlement</span>
                </div>
              </div>

              <p className="text-sm sm:text-base text-zinc-600 max-w-2xl leading-relaxed mb-6 font-normal">
                Autonomous buyer &amp; seller AI agents negotiate within confidential human mandates. 
                A zero-LLM TypeScript kernel verifies every proposal before automated PayPal Sandbox invoicing.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3.5 flex-wrap justify-center mb-10">
                <Link
                  href="/deals/new"
                  className="glossy-btn-blue px-6 py-3 rounded-xl font-bold text-xs tracking-wider uppercase font-mono flex items-center gap-2 active:scale-95 transition-all text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>+ Create Deal Room</span>
                </Link>

                <a
                  href="#deals"
                  className="px-5 py-3 rounded-xl font-semibold text-xs text-zinc-700 font-mono flex items-center gap-2 transition-all bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 hover:text-zinc-900"
                >
                  <span className="material-symbols-outlined text-[18px] text-blue-600">table_rows</span>
                  <span>Browse Active Deals ({deals.length})</span>
                </a>
              </div>

              {/* ========================================================
                  SIGNATURE FLOATING OFFER CARDS & PROTOCOL RIBBON (Matching banner.png)
                  ======================================================== */}
              <div className="w-full max-w-3xl flex flex-col gap-5 pt-3">
                {/* Floating Cards Arena */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left Floating Card: Buyer Offer ($280) */}
                  <div className="banner-offer-card p-4.5 text-zinc-900 flex flex-col justify-between text-left relative overflow-hidden group border border-zinc-200">
                    <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 bg-blue-500/10 rounded-full blur-xl" />
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-zinc-600">
                        Buyer Bid
                      </span>
                      {/* Metallic Chrome Star/Sparkle as in banner */}
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-zinc-200 text-zinc-700 border border-zinc-200 shadow-inner">
                        <span className="material-symbols-outlined text-[13px] text-zinc-800 font-bold">spark</span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="font-outfit text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
                        $280
                      </span>
                      <span className="font-mono text-xs text-zinc-600 font-semibold">
                        5d · 2 rev
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-[11px] font-mono text-zinc-600">
                      <span>20% Upfront Deposit</span>
                      <span className="text-emerald-600 font-bold">Within ZOPA</span>
                    </div>
                  </div>

                  {/* Right Floating Card: Seller Ask ($295) */}
                  <div className="banner-offer-card p-4.5 text-zinc-900 flex flex-col justify-between text-left relative overflow-hidden group border border-zinc-200">
                    <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 bg-cyan-400/15 rounded-full blur-xl" />
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-blue-600">
                        Seller Counter
                      </span>
                      {/* Electric Blue Star/Sparkle as in banner */}
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/20 text-blue-600 border border-blue-400/30 shadow-inner">
                        <span className="material-symbols-outlined text-[13px] text-blue-600 font-bold">spark</span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="font-outfit text-3xl sm:text-4xl font-black text-blue-600 tracking-tight">
                        $295
                      </span>
                      <span className="font-mono text-xs text-zinc-600 font-semibold">
                        5d · 2 rev
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-[11px] font-mono text-zinc-600">
                      <span>25% Upfront Deposit</span>
                      <span className="text-blue-600 font-bold">Agreement Point</span>
                    </div>
                  </div>
                </div>

                {/* 4-Step Protocol Ribbon (NEGOTIATE · VERIFY · AGREE · PAY) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="banner-step-segment rounded-xl p-3 flex items-center justify-center gap-2 text-zinc-800">
                    <span className="material-symbols-outlined text-[18px] text-zinc-600">smart_toy</span>
                    <span className="font-mono font-black text-[11px] tracking-wider uppercase">Negotiate</span>
                  </div>

                  <div className="banner-step-segment rounded-xl p-3 flex items-center justify-center gap-2 text-zinc-800">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">verified</span>
                    <span className="font-mono font-black text-[11px] tracking-wider uppercase">Verify</span>
                  </div>

                  <div className="banner-step-segment rounded-xl p-3 flex items-center justify-center gap-2 text-zinc-800">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">handshake</span>
                    <span className="font-mono font-black text-[11px] tracking-wider uppercase">Agree</span>
                  </div>

                  <div className="banner-step-segment rounded-xl p-3 flex items-center justify-center gap-2 text-zinc-800">
                    <span className="material-symbols-outlined text-[18px] text-cyan-600">payments</span>
                    <span className="font-mono font-black text-[11px] tracking-wider uppercase">Pay</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ========================================================
              METRICS GRID — Translucent Frosted Glass with Specular Rim
              ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric 1: Active Negotiations */}
            <div className="glass-panel-dark rounded-2xl p-6 border border-zinc-200 relative overflow-hidden group">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-xs text-zinc-600 uppercase tracking-wider font-bold">
                  Active Negotiations
                </span>
                <span className="flex h-3 w-3 relative items-center justify-center">
                  {activeNegotiations > 0 ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500 shadow-[0_0_8px_#38bdf8]" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600" />
                  )}
                </span>
              </div>
              <div className="flex items-baseline gap-3 pt-1">
                <span className="font-outfit text-4xl lg:text-5xl text-zinc-900 font-black tracking-tight">
                  {activeNegotiations}
                </span>
                <span className={`font-mono text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  activeNegotiations > 0 
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600" 
                    : "bg-zinc-100 border-zinc-200 text-zinc-600"
                }`}>
                  {activeNegotiations > 0 ? "Live Rooms" : "Idle"}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-200 text-xs text-zinc-600 font-mono">
                <span>{activeNegotiations === 1 ? "1 active room" : `${activeNegotiations} active rooms`}</span>
                <span className="text-zinc-500">Total: {deals.length} deals</span>
              </div>
            </div>

            {/* Metric 2: Agreements Reached */}
            <div className="glass-panel-dark rounded-2xl p-6 border border-zinc-200 relative overflow-hidden group">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-xs text-zinc-600 uppercase tracking-wider font-bold">
                  Agreements Reached
                </span>
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
              </div>
              <div className="flex items-baseline gap-3 pt-1">
                <span className="font-outfit text-4xl lg:text-5xl text-emerald-600 font-black tracking-tight">
                  {agreementsReached}
                </span>
                <span className="font-mono text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold">
                  Consensus
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-200 text-xs text-zinc-600 font-mono">
                <span>
                  {deals.length > 0
                    ? `${Math.round((agreementsReached / deals.length) * 100)}% agreement rate`
                    : "No deals recorded"}
                </span>
                <span className="text-zinc-500">
                  {agreementsReached} of {deals.length} consensus
                </span>
              </div>
            </div>

            {/* Metric 3: Settled Deposits (Sandbox) */}
            <div className="glass-panel-dark rounded-2xl p-6 border border-zinc-200 relative overflow-hidden group">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-xs text-zinc-600 uppercase tracking-wider font-bold">
                  Settled Deposits (Sandbox)
                </span>
                <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                </div>
              </div>
              <div className="flex items-baseline gap-3 pt-1">
                <span className="font-outfit text-4xl lg:text-5xl text-zinc-900 font-black tracking-tight">
                  ${settledAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono text-xs text-blue-600 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-full font-semibold">
                  USD Sandbox
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-200 text-xs text-zinc-600 font-mono">
                <span>
                  {paidDeals.length === 1
                    ? "1 paid deposit"
                    : `${paidDeals.length} paid deposits`}
                </span>
                <span className="text-zinc-500">PayPal Invoicing</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              DEALS TABLE MANAGEMENT PANEL — High-Definition Dark Glass Look
              ======================================================== */}
          <div id="deals" className="glass-panel-dark-elevated rounded-3xl overflow-hidden border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {/* Table Controls Bar */}
            <div className="p-4 sm:p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50">
              
              {/* Filter Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-zinc-100 p-1.5 rounded-xl border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                      statusFilter === "all"
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    All ({deals.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("active")}
                    className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                      statusFilter === "active"
                        ? "bg-blue-500 text-white shadow-[0_0_12px_#38bdf8]"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    Active ({activeNegotiations})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("agreed")}
                    className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                      statusFilter === "agreed"
                        ? "bg-emerald-500 text-white shadow-[0_0_12px_#34d399]"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    Agreed ({agreementsReached})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("closed")}
                    className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                      statusFilter === "closed"
                        ? "bg-zinc-700 text-white shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    Closed ({closedCount})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-zinc-500">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter by deal title or participant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 font-mono text-xs uppercase tracking-wider">
                    <th className="py-4 px-6 font-bold">Deal Title &amp; Details</th>
                    <th className="py-4 px-4 font-bold">Participants</th>
                    <th className="py-4 px-4 font-bold">Status</th>
                    <th className="py-4 px-4 font-bold">Rounds</th>
                    <th className="py-4 px-4 font-bold text-right">Latest Standing Offer</th>
                    <th className="py-4 px-4 font-bold text-center">Payment State</th>
                    <th className="py-4 px-6 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-sans text-sm text-zinc-800">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 px-6 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto text-zinc-600">
                          <div className="h-12 w-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[28px] text-blue-600">handshake</span>
                          </div>
                          <span className="font-bold text-zinc-900 text-base font-outfit">
                            {deals.length === 0 ? "No negotiation deals found" : "No deals match your search"}
                          </span>
                          <p className="text-xs text-zinc-600 text-center leading-relaxed">
                            {deals.length === 0
                              ? "Create a deal room to define private mandates and begin bilateral negotiation."
                              : "Try clearing your filters or changing search keywords."}
                          </p>
                          {deals.length === 0 && (
                            <Link
                              href="/deals/new"
                              className="mt-2 glossy-btn-blue px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all text-white"
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
                        <tr key={deal.id} className="hover:bg-zinc-50 transition-colors group">
                          {/* Deal Name & Context */}
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                                  {deal.title}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-600 font-mono text-[11px]">
                                  #{deal.id.slice(0, 8)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-600 text-xs truncate max-w-xs">
                                  {deal.description || "Bilateral 1:1 negotiation room"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Participants */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 font-mono text-xs">
                              <div className="flex items-center gap-1.5 text-zinc-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#38bdf8]" />
                                <span className="font-bold text-zinc-900">{buyerDisplayName}</span>
                                <span className="text-zinc-500 text-[10px]">(Buyer)</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-zinc-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                <span className="font-semibold text-zinc-700">{sellerDisplayName}</span>
                                <span className="text-zinc-500 text-[10px]">(Seller)</span>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {deal.status === "open" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 font-mono text-xs font-bold">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400 shadow-[0_0_6px_#38bdf8]" />
                                </span>
                                Negotiating
                              </span>
                            ) : deal.status === "tentative_agreement" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 font-mono text-xs font-bold">
                                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                Awaiting Signatures
                              </span>
                            ) : deal.status === "agreed" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-mono text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                Agreed
                              </span>
                            ) : deal.status === "deposit_invoiced" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 font-mono text-xs font-bold">
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                Invoiced
                              </span>
                            ) : deal.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 font-mono text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                                <span className="material-symbols-outlined text-[14px] text-emerald-600">done_all</span>
                                Paid
                              </span>
                            ) : deal.status === "no_deal" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 font-mono text-xs font-bold">
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                                No Deal
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-mono text-xs font-semibold">
                                Setup
                              </span>
                            )}
                          </td>

                          {/* Rounds */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs text-zinc-700 font-bold">
                              {roundCount} / {maxRounds}
                            </span>
                          </td>

                          {/* Latest Standing Offer */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm font-black text-zinc-900">
                                {price != null ? `$${price}` : "—"}
                              </span>
                              <span className="font-mono text-[10px] text-zinc-500">
                                {price != null ? (isClosed ? "Final Terms" : "Current Bid") : "No offers yet"}
                              </span>
                            </div>
                          </td>

                          {/* Payment State */}
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {paymentState === "Invoiced" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 font-mono text-xs font-semibold">
                                <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                                Invoiced
                              </span>
                            ) : paymentState === "Paid" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-mono text-xs font-bold">
                                <span className="material-symbols-outlined text-[12px]">payments</span>
                                Paid
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-zinc-500 font-medium">—</span>
                            )}
                          </td>

                          {/* Action CTA */}
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            {isClosed ? (
                              <Link
                                href={`/deals/${deal.id}/reveal`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 font-mono text-xs font-bold transition-all shadow-xs"
                              >
                                <span>View Reveal</span>
                                <span className="material-symbols-outlined text-[15px]">visibility</span>
                              </Link>
                            ) : (
                              <Link
                                href={`/deals/${deal.id}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glossy-btn-blue text-white font-mono text-xs font-bold transition-all shadow-xs"
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
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-zinc-600 font-mono text-xs">
              <span>Displaying {filteredDeals.length} of {deals.length} deals</span>
              <span className="text-zinc-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#34d399]" />
                Deterministic Kernel Verification Active
              </span>
            </div>
          </div>

          {/* ========================================================
              SYSTEM ARCHITECTURE OVERVIEW PANEL — Frosted Dark Glass Cards
              ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-panel-dark rounded-2xl p-6 flex flex-col gap-2.5 border border-zinc-200 text-zinc-700">
              <div className="flex items-center gap-2.5 text-zinc-900 font-bold text-sm font-outfit">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
                  <span className="material-symbols-outlined text-[20px]">shield</span>
                </div>
                <span>Deterministic Kernel</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Zero-LLM settlement engine. Offers and acceptances must strictly satisfy each participant&apos;s private mandate bounds before entering the event log.
              </p>
            </div>
            
            <div className="glass-panel-dark rounded-2xl p-6 flex flex-col gap-2.5 border border-zinc-200 text-zinc-700">
              <div className="flex items-center gap-2.5 text-zinc-900 font-bold text-sm font-outfit">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center border border-purple-500/20">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <span>Dual-Party Privacy</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Mandates remain cryptographically private to each participant. Both mandates unseal only upon mutual consensus or deal closing.
              </p>
            </div>

            <div className="glass-panel-dark rounded-2xl p-6 flex flex-col gap-2.5 border border-zinc-200 text-zinc-700">
              <div className="flex items-center gap-2.5 text-zinc-900 font-bold text-sm font-outfit">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <span>PayPal Sandbox Settlement</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Agreed contracts trigger automated deposit and balance invoicing through the PayPal Sandbox API from a tamper-evident contract hash.
              </p>
            </div>
          </div>

        </div>
      </main>

      <footer className="w-full bg-white/80 backdrop-blur-md border-t border-zinc-200 py-6 relative z-10">
        <div className="w-full px-4 lg:px-8 max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 font-mono text-xs">
          <span>© 2026 AgentPal. Bilateral Autonomous Negotiation &amp; Sandbox Settlement.</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#34d399]" />
              Environment: Sandbox
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
