"use client";

import { useState, useCallback, useEffect, use, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { DealStore, type DealData, toDealData } from "@/lib/deal-store";
import { SettlementKernel } from "@/lib/settlement-kernel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConvergenceChart } from "@/components/deal-room/convergence-chart";
import { SealedMandatesCard } from "@/components/deal-room/sealed-mandates-card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DealRoomPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dealId = resolvedParams.id;

  const convexDealDoc = useQuery(api.deals.get, { dealId });
  const [deal, setDeal] = useState<DealData | null>(() => DealStore.getDeal(dealId));
  const [prevDoc, setPrevDoc] = useState(convexDealDoc);
  if (convexDealDoc !== prevDoc) {
    setPrevDoc(convexDealDoc);
    if (convexDealDoc) {
      const formatted = toDealData(convexDealDoc as Record<string, unknown>);
      if (!formatted.buyerMandate && deal?.buyerMandate) {
        formatted.buyerMandate = deal.buyerMandate;
      }
      if (!formatted.sellerMandate && deal?.sellerMandate) {
        formatted.sellerMandate = deal.sellerMandate;
      }
      if (deal?.status === "open" && formatted.status === "setup") {
        formatted.status = "open";
      }
      setDeal(formatted);
      DealStore.saveDeal(formatted);
    }
  }

  // Fallback sync from DealStore
  useEffect(() => {
    const sync = () => {
      const fresh = DealStore.getDeal(dealId);
      if (fresh) {
        setDeal(JSON.parse(JSON.stringify(fresh)));
      }
    };
    return DealStore.subscribe(sync);
  }, [dealId]);

  const confirmTentative = useMutation(api.deals.confirmTentativeAgreement);
  const updateDealMutation = useMutation(api.deals.updateDeal);
  const [signBusy, setSignBusy] = useState(false);

  // Role: derived server-side from auth (viewerRole); localStorage only as fallback
  const [storedRole, setStoredRole] = useState<"buyer" | "seller" | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(`agentpal_role_${dealId}`);
    return stored === "buyer" || stored === "seller" ? stored : null;
  });
  const [prevDealId, setPrevDealId] = useState(dealId);
  if (dealId !== prevDealId) {
    setPrevDealId(dealId);
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(`agentpal_role_${dealId}`);
      setStoredRole(stored === "buyer" || stored === "seller" ? stored : null);
    }
  }
  const myRole = deal?.viewerRole ?? storedRole;

  const handleConfirm = useCallback(async () => {
    setSignBusy(true);
    try {
      await confirmTentative({ dealId });
    } catch (e) {
      console.error("Confirm failed", e);
    } finally {
      setSignBusy(false);
    }
  }, [confirmTentative, dealId]);

  const [autoPlaying, setAutoPlaying] = useState(false);
  const [takeoverOpen, setTakeoverOpen] = useState(false);

  // Takeover form states
  const [takeoverPrice, setTakeoverPrice] = useState(300);
  const [takeoverDays, setTakeoverDays] = useState(5);
  const [takeoverRevisions, setTakeoverRevisions] = useState(2);
  const [takeoverDeposit, setTakeoverDeposit] = useState(25);
  const [takeoverMessage, setTakeoverMessage] = useState("Human takeover: proposing structured counter-terms.");
  const [takeoverError, setTakeoverError] = useState<string | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);

  const events = useMemo(() => deal?.events ?? [], [deal?.events]);
  const roundCount = events.filter((e) => e.type === "offer").length;
  const maxRounds = deal?.maxRounds || 6;

  // Standing offer terms
  const standingOffer = deal?.standingOffer || deal?.contract?.terms || null;

  // Audit log auto-scroll
  const auditLogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (auditLogRef.current) {
      auditLogRef.current.scrollTop = auditLogRef.current.scrollHeight;
    }
  }, [events.length]);

  // Populate simulated counterparty for solo sandbox testing
  const handlePopulateSandboxCounterparty = useCallback(async () => {
    if (!deal) return;
    const isBuyerCreator = deal.creatorRole === "buyer";
    const myMandate = isBuyerCreator ? deal.buyerMandate : deal.sellerMandate;
    if (!myMandate) return;

    const simulatedMandate = isBuyerCreator
      ? {
          role: "seller" as const,
          price_min: Math.max(50, myMandate.price_min - 20),
          price_max: myMandate.price_max + 40,
          delivery_days_min: myMandate.delivery_days_min,
          delivery_days_max: myMandate.delivery_days_max + 2,
          revisions_min: 1,
          revisions_max: 2,
          deposit_pct_min: 20,
          deposit_pct_max: 40,
        }
      : {
          role: "buyer" as const,
          price_min: Math.max(50, myMandate.price_min - 40),
          price_max: myMandate.price_max + 20,
          delivery_days_min: Math.max(1, myMandate.delivery_days_min - 2),
          delivery_days_max: myMandate.delivery_days_max,
          revisions_min: 2,
          revisions_max: 3,
          deposit_pct_min: 15,
          deposit_pct_max: 30,
        };

    const updated: DealData = {
      ...deal,
      status: "open",
      buyerMandate: isBuyerCreator ? myMandate : simulatedMandate,
      sellerMandate: isBuyerCreator ? simulatedMandate : myMandate,
      seller: isBuyerCreator
        ? { id: "simulated-seller", name: "Simulated Seller (Sandbox)", email: "seller-sandbox@agentpal.local", mandateSet: true }
        : deal.seller,
      buyer: !isBuyerCreator
        ? { id: "simulated-buyer", name: "Simulated Buyer (Sandbox)", email: "buyer-sandbox@agentpal.local", mandateSet: true }
        : deal.buyer,
    };

    DealStore.saveDeal(updated);
    setDeal(JSON.parse(JSON.stringify(updated)));
    setTurnError(null);

    try {
      await updateDealMutation({ dealId, patch: { status: "open" } });
    } catch {
      // Local/offline fallback
    }
  }, [deal, dealId, updateDealMutation]);

  // Handle running next negotiation turn via live AI helper API
  const handleNextTurn = useCallback(
    async (forcedAttack?: boolean) => {
      if (!deal || isSubmittingTurn || deal.status !== "open") return;
      if (!deal.buyerMandate || !deal.sellerMandate) {
        setTurnError("Both mandates must be set before negotiation starts. Share your invite link or click 'Simulate Counterparty'.");
        return;
      }
      setIsSubmittingTurn(true);
      setTurnError(null);
      try {
        const isAttack = forcedAttack !== undefined ? forcedAttack : Boolean(deal.attackMode);

        const res = await fetch(`/api/deals/${deal.id}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attackMode: isAttack, deal }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.deal) {
            DealStore.saveDeal(data.deal);
            setDeal(JSON.parse(JSON.stringify(data.deal)));
            if (data.deal.status !== "open") {
              setAutoPlaying(false);
            }
            return;
          }
        } else {
          const data = await res.json().catch(() => ({}));
          if (data.error) {
            setTurnError(data.error);
            setAutoPlaying(false);
            return;
          }
        }

        // Local store fallback
        const updated = DealStore.runNextTurn(deal.id, isAttack);
        if (updated) {
          setDeal(JSON.parse(JSON.stringify(updated)));
          if (updated.status !== "open") {
            setAutoPlaying(false);
          }
        }
      } catch (err) {
        console.error("Turn execution error", err);
        setTurnError(err instanceof Error ? err.message : "Failed to execute turn");
        setAutoPlaying(false);
      } finally {
        setIsSubmittingTurn(false);
      }
    },
    [deal, isSubmittingTurn]
  );

  // Auto-play loop
  useEffect(() => {
    if (!autoPlaying || !deal || deal.status !== "open") return;
    const timer = setTimeout(() => {
      handleNextTurn();
    }, 1800);
    return () => clearTimeout(timer);
  }, [autoPlaying, deal, events.length, handleNextTurn]);

  // Toggle attack mode / red team
  const handleToggleAttackMode = () => {
    if (!deal) return;
    const newMode = !deal.attackMode;
    const updated = { ...deal, attackMode: newMode };
    DealStore.saveDeal(updated);
    setDeal(updated);

    if (newMode && deal.status === "open") {
      handleNextTurn(true);
    }
  };

  // Submit human takeover offer
  const handleSubmitTakeover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) return;

    setTakeoverError(null);
    const mandate = myRole === "seller" ? deal.sellerMandate : deal.buyerMandate;

    if (!mandate) {
      setTakeoverError("Your role mandate bounds are not set.");
      return;
    }

    const proposedOffer = {
      price: takeoverPrice,
      delivery_days: takeoverDays,
      revisions: takeoverRevisions,
      deposit_pct: takeoverDeposit,
      message: takeoverMessage,
    };

    const offerValidation = SettlementKernel.validateOffer(proposedOffer, mandate);
    if (!offerValidation.valid) {
      setTakeoverError(offerValidation.violations.join("; ") || "Offer is outside mandate bounds.");
      return;
    }

    const leakCheck = SettlementKernel.checkMessageLeak(takeoverMessage, proposedOffer, mandate);
    if (leakCheck.leaked) {
      setTakeoverError(leakCheck.violations.join("; ") || "Confidential mandate leak detected in message.");
      return;
    }

    setIsSubmittingTurn(true);
    try {
      const res = DealStore.humanTakeover(deal.id, myRole === "seller" ? "seller" : "buyer", proposedOffer);
      if (res.deal) {
        setDeal(JSON.parse(JSON.stringify(res.deal)));
      }
      setTakeoverOpen(false);
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  if (!deal && convexDealDoc === null) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <span className="material-symbols-outlined text-[24px]">search_off</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Deal Room Not Found</h1>
        <p className="text-xs text-slate-500 mb-6 max-w-sm">
          No deal was found matching ID &ldquo;{dealId}&rdquo;. It may have been cleared or not yet created.
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
          <span className="material-symbols-outlined animate-spin text-emerald-600">sync</span>
          <span>Loading negotiation room...</span>
        </div>
      </div>
    );
  }

  const isClosed = ["agreed", "deposit_invoiced", "paid"].includes(deal.status);
  const buyerName = deal.buyer?.name || "Buyer";
  const sellerName = deal.seller?.name || "Seller";

  // Find latest model used by each side from event history
  const latestBuyerModel = events
    .filter((e) => e.actor.includes("buyer") && e.payload?.modelUsed)
    .slice(-1)[0]?.payload?.modelUsed;
  const latestSellerModel = events
    .filter((e) => e.actor.includes("seller") && e.payload?.modelUsed)
    .slice(-1)[0]?.payload?.modelUsed;

  return (
    <div className="bg-[#F8FAFC] font-sans text-slate-800 antialiased min-h-screen flex flex-col">
      <main className="w-full bg-[#F8FAFC] flex-1 pb-8">
        <div className="w-full px-4 lg:px-8 py-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
          {/* Header & Controls */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 flex items-center justify-center text-[#475569] shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-950 p-1 shadow-xs border border-slate-800 flex items-center justify-center">
                      <Image
                        src="/logo.png"
                        alt="AgentPal Logo"
                        width={24}
                        height={24}
                        className="h-6 w-6 object-contain"
                        priority
                      />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                      Deal Room: {deal.title}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-[#64748B] mt-1">
                    <span>DEAL: {deal.id.slice(0, 16)}</span>
                    <span>•</span>
                    <span>ROUNDS: {roundCount} / {maxRounds}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">Bilateral Kernel Enforced</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                {/* Status Pill */}
                {deal.status === "setup" || (!deal.buyerMandate || !deal.sellerMandate) ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">hourglass_top</span>
                    Awaiting Counterparty
                  </span>
                ) : deal.status === "open" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-xs font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Negotiating
                  </span>
                ) : deal.status === "tentative_agreement" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-mono text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">edit_note</span>
                    Awaiting Signatures
                  </span>
                ) : deal.status === "agreed" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    Agreed
                  </span>
                ) : deal.status === "deposit_invoiced" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                    Invoiced
                  </span>
                ) : deal.status === "paid" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px]">payments</span>
                    Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                    No Deal
                  </span>
                )}

                {/* Primary Actions */}
                <div className="flex items-center gap-2">
                  {deal.status === "open" && deal.buyerMandate && deal.sellerMandate && (
                    <>
                      <button
                        type="button"
                        onClick={handleToggleAttackMode}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all ${
                          deal.attackMode
                            ? "bg-rose-50 border-rose-300 text-rose-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {deal.attackMode ? "Red Team Active" : "Simulate Injection"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setTakeoverOpen(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-mono text-xs font-semibold transition-colors shadow-2xs"
                      >
                        Human Takeover
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNextTurn()}
                        disabled={isSubmittingTurn}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        Step Next Turn
                      </button>

                      <button
                        type="button"
                        onClick={() => setAutoPlaying(!autoPlaying)}
                        className={`px-4 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all shadow-xs ${
                          autoPlaying
                            ? "bg-amber-600 hover:bg-amber-700 text-white"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        {autoPlaying ? "Pause Auto" : "Auto-Negotiate"}
                      </button>
                    </>
                  )}

                  {(deal.status === "setup" || !deal.buyerMandate || !deal.sellerMandate) && (
                    <button
                      type="button"
                      onClick={handlePopulateSandboxCounterparty}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">smart_toy</span>
                      <span>Simulate Counterparty (Sandbox)</span>
                    </button>
                  )}

                  {deal.status === "tentative_agreement" && (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={signBusy}
                      className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-sans text-sm font-bold transition-all flex items-center gap-2 shadow-xs active:scale-95 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[20px]">draw</span>
                      <span>{signBusy ? "Affirming..." : "Affirm & Sign Contract"}</span>
                    </button>
                  )}

                  {isClosed && (
                    <Link
                      href={`/deals/${deal.id}/reveal`}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-sm font-bold transition-all flex items-center gap-2 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                      <span>View Reveal &amp; Settlement</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Turn Error Banner */}
            {turnError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
                  <span>{turnError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTurnError(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Awaiting Counterparty Banner */}
            {(deal.status === "setup" || !deal.buyerMandate || !deal.sellerMandate) && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">info</span>
                  <span>
                    <strong>Awaiting Counterparty:</strong> Share your magic invite link, or click <strong>Simulate Counterparty (Sandbox)</strong> to populate a realistic counterparty mandate and test bilateral negotiation in this session.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePopulateSandboxCounterparty}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-semibold transition-colors"
                  >
                    Simulate Counterparty
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Analytics & Mandates Row */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Price Convergence Chart */}
            <div className="lg:col-span-2">
              <ConvergenceChart
                events={events}
                buyerName={buyerName}
                sellerName={sellerName}
              />
            </div>

            {/* Sealed Mandates Privacy Card */}
            <div className="lg:col-span-1">
              <SealedMandatesCard
                buyerName={buyerName}
                sellerName={sellerName}
                buyerMandate={deal.buyerMandate}
                sellerMandate={deal.sellerMandate}
                viewerRole={myRole}
                isClosed={isClosed}
              />
            </div>
          </section>

          {/* Bilateral Agent Arena (3-Column Layout) */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Buyer Agent Column (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#047857] font-bold text-base">
                    {buyerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Buyer Agent ({buyerName})
                    </h3>
                    <span className="font-mono text-xs text-slate-500">
                      {latestBuyerModel || "Autonomous Buyer Agent"}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-medium">
                  Buyer Role
                </span>
              </div>

              {/* Buyer Offers Stream */}
              <div className="flex flex-col gap-3">
                {events
                  .filter((e) => e.actor.includes("buyer"))
                  .map((ev, idx) => {
                    const isBlocked = ev.type === "blocked";
                    const p = ev.payload || {};

                    if (isBlocked) {
                      return (
                        <div key={ev.id || idx} className="rounded-2xl bg-rose-50 border border-rose-200 p-4 shadow-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-rose-700">Turn Blocked by Kernel</span>
                            <span className="text-rose-400 font-mono text-xs">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-rose-700">
                            {p.blocked_reason || "Offer violated sealed mandate limits."}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div key={ev.id || idx} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-emerald-700">
                            Turn #{ev.seq} · {ev.type === "accept" ? "Acceptance" : "Offer"}
                          </span>
                          <span className="text-slate-400 font-mono text-xs">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 py-2 px-2 bg-slate-50 rounded-xl text-center font-mono text-xs">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Price</span>
                            <span className="font-bold text-slate-900">${p.price ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Days</span>
                            <span className="font-bold text-slate-900">{p.delivery_days ?? "—"}d</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Revs</span>
                            <span className="font-bold text-slate-900">{p.revisions ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Deposit</span>
                            <span className="font-bold text-slate-900">{p.deposit_pct != null ? `${p.deposit_pct}%` : "—"}</span>
                          </div>
                        </div>
                        {p.message && (
                          <p className="text-xs text-slate-600 italic">
                            &ldquo;{p.message}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}

                {events.filter((e) => e.actor.includes("buyer")).length === 0 && (
                  <div className="p-6 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-mono">
                    Awaiting opening bid from buyer agent...
                  </div>
                )}
              </div>
            </div>

            {/* Referee Kernel Column (2 Cols) */}
            <div className="lg:col-span-2 flex flex-col items-center gap-4">
              <div className="w-full rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-emerald-700 text-[22px]">gavel</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Settlement Kernel</h4>
                <span className="font-mono text-xs text-slate-400">Deterministic Invariants</span>

                <div className="mt-4 pt-3 border-t border-slate-100 w-full space-y-2 text-left font-mono text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Round:</span>
                    <span className="font-bold text-slate-900">{roundCount} / {maxRounds}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Standing:</span>
                    <span className="font-bold text-emerald-700">
                      {standingOffer ? `$${standingOffer.price}` : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Leak Guard:</span>
                    <span className="font-semibold text-emerald-600">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seller Agent Column (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-base">
                    {sellerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Seller Agent ({sellerName})
                    </h3>
                    <span className="font-mono text-xs text-slate-500">
                      {latestSellerModel || "Autonomous Seller Agent"}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-medium">
                  Seller Role
                </span>
              </div>

              {/* Seller Offers Stream */}
              <div className="flex flex-col gap-3">
                {events
                  .filter((e) => e.actor.includes("seller"))
                  .map((ev, idx) => {
                    const isBlocked = ev.type === "blocked";
                    const p = ev.payload || {};

                    if (isBlocked) {
                      return (
                        <div key={ev.id || idx} className="rounded-2xl bg-rose-50 border border-rose-200 p-4 shadow-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-rose-700">Turn Blocked by Kernel</span>
                            <span className="text-rose-400 font-mono text-xs">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-rose-700">
                            {p.blocked_reason || "Offer violated sealed mandate limits."}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div key={ev.id || idx} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-emerald-700">
                            Turn #{ev.seq} · {ev.type === "accept" ? "Acceptance" : "Offer"}
                          </span>
                          <span className="text-slate-400 font-mono text-xs">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 py-2 px-2 bg-slate-50 rounded-xl text-center font-mono text-xs">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Price</span>
                            <span className="font-bold text-slate-900">${p.price ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Days</span>
                            <span className="font-bold text-slate-900">{p.delivery_days ?? "—"}d</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Revs</span>
                            <span className="font-bold text-slate-900">{p.revisions ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Deposit</span>
                            <span className="font-bold text-slate-900">{p.deposit_pct != null ? `${p.deposit_pct}%` : "—"}</span>
                          </div>
                        </div>
                        {p.message && (
                          <p className="text-xs text-slate-600 italic">
                            &ldquo;{p.message}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}

                {events.filter((e) => e.actor.includes("seller")).length === 0 && (
                  <div className="p-6 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-mono">
                    Awaiting opening bid from seller agent...
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Audit Log / Event Stream */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-[20px]">terminal</span>
                <h3 className="font-bold text-slate-900 text-sm">Negotiation Audit Event Stream</h3>
              </div>
              <span className="font-mono text-xs text-slate-400">{events.length} recorded events</span>
            </div>

            <div
              ref={auditLogRef}
              className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto space-y-1.5"
            >
              {events.length === 0 ? (
                <div className="text-slate-500 italic">No events recorded in this negotiation room yet.</div>
              ) : (
                events.map((ev, idx) => (
                  <div key={ev.id || idx} className="flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">
                      [{new Date(ev.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="text-emerald-400 font-semibold shrink-0">
                      #{ev.seq} {ev.actor}
                    </span>
                    <span className="text-slate-300">
                      {ev.type === "offer"
                        ? `proposed price $${ev.payload?.price}, ${ev.payload?.delivery_days}d delivery, ${ev.payload?.revisions} rev, ${ev.payload?.deposit_pct}% deposit`
                        : ev.type === "accept"
                        ? `accepted standing offer: $${ev.payload?.price}`
                        : ev.type === "blocked"
                        ? `BLOCKED: ${ev.payload?.blocked_reason || "Violated mandate"}`
                        : JSON.stringify(ev.payload || {})}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Human Takeover Dialog Modal */}
      {takeoverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">front_hand</span>
                <h3 className="font-bold text-slate-900">Manual Human Takeover</h3>
              </div>
              <button
                type="button"
                onClick={() => setTakeoverOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTakeover} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 uppercase">Price ($)</span>
                  <input
                    type="number"
                    value={takeoverPrice}
                    onChange={(e) => setTakeoverPrice(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-slate-500 uppercase">Days</span>
                  <input
                    type="number"
                    value={takeoverDays}
                    onChange={(e) => setTakeoverDays(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 uppercase">Revisions</span>
                  <input
                    type="number"
                    value={takeoverRevisions}
                    onChange={(e) => setTakeoverRevisions(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-slate-500 uppercase">Deposit (%)</span>
                  <input
                    type="number"
                    value={takeoverDeposit}
                    onChange={(e) => setTakeoverDeposit(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <span className="text-slate-500 uppercase">Message</span>
                <input
                  type="text"
                  value={takeoverMessage}
                  onChange={(e) => setTakeoverMessage(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2 text-slate-900"
                />
              </div>

              {takeoverError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {takeoverError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTakeoverOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTurn}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Submit Human Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
