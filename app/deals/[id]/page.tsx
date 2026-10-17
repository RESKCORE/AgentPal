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

  // Sync from Convex realtime subscription without dropping existing events or mandate state
  useEffect(() => {
    if (!convexDealDoc) return;
    const formatted = toDealData(convexDealDoc as Record<string, unknown>);
    setDeal((currentDeal) => {
      const merged = { ...formatted };
      if (!merged.buyerMandate && currentDeal?.buyerMandate) {
        merged.buyerMandate = currentDeal.buyerMandate;
      }
      if (!merged.sellerMandate && currentDeal?.sellerMandate) {
        merged.sellerMandate = currentDeal.sellerMandate;
      }
      if (currentDeal?.status === "open" && merged.status === "setup") {
        merged.status = "open";
      }
      // Never drop events if local/current state has recorded turns
      if (currentDeal?.events && currentDeal.events.length > (merged.events?.length || 0)) {
        merged.events = currentDeal.events;
      }
      if (!merged.standingOffer && currentDeal?.standingOffer) {
        merged.standingOffer = currentDeal.standingOffer;
      }
      if ((merged.currentRound ?? 0) < (currentDeal?.currentRound ?? 0)) {
        merged.currentRound = currentDeal?.currentRound ?? merged.currentRound;
      }
      if (
        merged.seller?.name === "Invited counterparty" &&
        currentDeal?.seller?.name &&
        currentDeal.seller.name !== "Invited counterparty"
      ) {
        merged.seller = currentDeal.seller;
      }
      if (
        merged.buyer?.name === "Invited counterparty" &&
        currentDeal?.buyer?.name &&
        currentDeal.buyer.name !== "Invited counterparty"
      ) {
        merged.buyer = currentDeal.buyer;
      }
      DealStore.saveDeal(merged);
      return merged;
    });
  }, [convexDealDoc]);

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
  const populateSandboxCounterpartyMutation = useMutation(api.deals.populateSandboxCounterparty);
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

  const buyerStreamRef = useRef<HTMLDivElement>(null);
  const sellerStreamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (buyerStreamRef.current) {
      buyerStreamRef.current.scrollTop = buyerStreamRef.current.scrollHeight;
    }
    if (sellerStreamRef.current) {
      sellerStreamRef.current.scrollTop = sellerStreamRef.current.scrollHeight;
    }
  }, [events.length]);

  // Standing offer terms
  const standingOffer = deal?.standingOffer || deal?.contract?.terms || null;

  // Bilateral readiness checks:
  // On the client, mandate privacy intentionally returns null for the counterparty's private mandate.
  // Both parties are ready if status is open/beyond, or both parties have mandateSet === true, or both mandates are loaded.
  const bothPartiesReady = Boolean(
    deal &&
      (deal.status === "open" ||
        deal.status === "tentative_agreement" ||
        deal.status === "agreed" ||
        deal.status === "deposit_invoiced" ||
        deal.status === "paid" ||
        (deal.buyer?.mandateSet && deal.seller?.mandateSet) ||
        (Boolean(deal.buyerMandate) && Boolean(deal.sellerMandate)))
  );

  const isAwaitingCounterparty = Boolean(
    deal &&
      deal.status === "setup" &&
      (!deal.buyer?.mandateSet || !deal.seller?.mandateSet) &&
      (!deal.buyerMandate || !deal.sellerMandate)
  );

  // If both parties joined and set mandates while in setup, ensure deal status is open
  useEffect(() => {
    if (deal && deal.status === "setup" && deal.buyer?.mandateSet && deal.seller?.mandateSet) {
      updateDealMutation({ dealId, patch: { status: "open" } }).catch(() => {});
    }
  }, [deal, dealId, updateDealMutation]);

  // Audit log auto-scroll
  const auditLogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (auditLogRef.current) {
      auditLogRef.current.scrollTop = auditLogRef.current.scrollHeight;
    }
  }, [events.length]);

  // Populate simulated counterparty for solo sandbox testing
  const handlePopulateSandboxCounterparty = useCallback(async () => {
    if (!deal) return null;
    const isBuyerCreator = deal.creatorRole === "buyer";
    const myMandate = isBuyerCreator ? deal.buyerMandate : deal.sellerMandate;
    if (!myMandate) return null;

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

    const simulatedName = isBuyerCreator ? "Simulated Seller (Sandbox)" : "Simulated Buyer (Sandbox)";

    const updated: DealData = {
      ...deal,
      status: "open",
      buyerMandate: isBuyerCreator ? myMandate : simulatedMandate,
      sellerMandate: isBuyerCreator ? simulatedMandate : myMandate,
      seller: isBuyerCreator
        ? { id: "simulated-seller", name: simulatedName, email: "seller-sandbox@agentpal.local", mandateSet: true }
        : deal.seller,
      buyer: !isBuyerCreator
        ? { id: "simulated-buyer", name: simulatedName, email: "buyer-sandbox@agentpal.local", mandateSet: true }
        : deal.buyer,
    };

    DealStore.saveDeal(updated);
    setDeal(JSON.parse(JSON.stringify(updated)));
    setTurnError(null);

    try {
      await populateSandboxCounterpartyMutation({
        dealId,
        mandate: simulatedMandate,
        participantName: simulatedName,
      });
    } catch {
      try {
        await updateDealMutation({ dealId, patch: { status: "open" } });
      } catch {
        // Local/offline fallback
      }
    }
    return updated;
  }, [deal, dealId, populateSandboxCounterpartyMutation, updateDealMutation]);

  // Handle running next negotiation turn via live AI helper API
  const handleNextTurn = useCallback(
    async (forcedAttack?: boolean, preferredActor?: "buyer_agent" | "seller_agent") => {
      let activeDeal = deal;
      if (!activeDeal || isSubmittingTurn) return;

      // Auto-populate sandbox counterparty if counterparty mandate is missing
      if (!activeDeal.buyerMandate || !activeDeal.sellerMandate) {
        const populated = await handlePopulateSandboxCounterparty();
        if (populated) {
          activeDeal = populated;
        }
      }

      if (!activeDeal.buyerMandate || !activeDeal.sellerMandate) {
        setTurnError("Both parties must set their mandates before negotiation starts.");
        return;
      }

      setIsSubmittingTurn(true);
      setTurnError(null);
      try {
        const isAttack = forcedAttack !== undefined ? forcedAttack : Boolean(activeDeal.attackMode);

        const res = await fetch(`/api/deals/${activeDeal.id}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attackMode: isAttack, deal: activeDeal, preferredActor }),
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
        const updated = DealStore.runNextTurn(activeDeal.id, isAttack);
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
    [deal, isSubmittingTurn, handlePopulateSandboxCounterparty]
  );

  // Auto-play loop using ref to prevent stale closures and missed ticks
  const handleNextTurnRef = useRef(handleNextTurn);
  handleNextTurnRef.current = handleNextTurn;

  useEffect(() => {
    if (!autoPlaying || !deal || deal.status !== "open" || isSubmittingTurn) return;
    const timer = setTimeout(() => {
      handleNextTurnRef.current();
    }, 1800);
    return () => clearTimeout(timer);
  }, [autoPlaying, deal?.status, events.length, isSubmittingTurn]);

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
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-zinc-900 font-mono text-xs font-semibold shadow-xs"
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
    <div className="font-sans text-zinc-900 bg-white antialiased min-h-screen flex flex-col relative overflow-hidden">
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(59, 130, 246, 0.15) 45%, transparent 70%)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-15" />

      <main className="w-full flex-1 pb-16 relative z-10">
        <div className="w-full px-4 lg:px-8 py-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
          {/* Header & Controls */}
          <section className="glass-panel-dark-elevated rounded-3xl p-6 relative overflow-hidden flex flex-col gap-5 border border-zinc-200 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
            {/* Ambient specular highlight */}
            <div className="pointer-events-none absolute -top-20 right-1/4 h-48 w-72 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 flex items-center justify-center text-zinc-700 hover:text-zinc-900 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <Image
                      src="/logo.png"
                      alt="AgentPal Logo"
                      width={36}
                      height={36}
                      className="h-8 w-auto object-contain shrink-0"
                      priority
                    />
                    <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight font-outfit">
                      Deal Room: {deal.title}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-500 mt-1.5 flex-wrap">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 text-slate-700 font-semibold">
                      DEAL #{deal.id.slice(0, 8)}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-zinc-800">ROUNDS: {roundCount} / {maxRounds}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Bilateral Kernel Enforced
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                {/* Status Pill */}
                {isAwaitingCounterparty ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px]">hourglass_top</span>
                    Awaiting Counterparty
                  </span>
                ) : deal.status === "open" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                    </span>
                    Negotiating
                  </span>
                ) : deal.status === "tentative_agreement" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-mono text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px]">edit_note</span>
                    Awaiting Signatures
                  </span>
                ) : deal.status === "agreed" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    Agreed
                  </span>
                ) : deal.status === "deposit_invoiced" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                    Invoiced
                  </span>
                ) : deal.status === "paid" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-100 text-zinc-900 font-mono text-xs font-bold shadow-xs">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">payments</span>
                    Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                    No Deal
                  </span>
                )}

                {/* Primary Actions */}
                <div className="flex items-center gap-2">
                  {bothPartiesReady && deal.status === "open" && (
                    <>
                      <button
                        type="button"
                        onClick={handleToggleAttackMode}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                          deal.attackMode
                            ? "bg-rose-50 border-rose-300 text-rose-700 shadow-xs"
                            : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white"
                        }`}
                      >
                        {deal.attackMode ? "Red Team Active" : "Simulate Injection"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setTakeoverOpen(true)}
                        className="glass-panel px-3.5 py-1.5 rounded-xl hover:bg-white text-zinc-900 font-mono text-xs font-bold transition-all shadow-2xs"
                      >
                        Human Takeover
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNextTurn()}
                        disabled={isSubmittingTurn}
                        className="glass-panel px-3.5 py-1.5 rounded-xl hover:bg-white text-zinc-900 font-mono text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
                      >
                        {isSubmittingTurn ? "Evaluating..." : "Step Next Turn"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAutoPlaying(!autoPlaying)}
                        className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all shadow-xs ${
                          autoPlaying
                            ? "bg-amber-500 text-zinc-900 hover:bg-amber-600"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {autoPlaying ? "Pause Auto" : "Auto-Negotiate (AI)"}
                      </button>
                    </>
                  )}

                  {isAwaitingCounterparty && (
                    <button
                      type="button"
                      onClick={handlePopulateSandboxCounterparty}
                      className="glossy-btn-dark px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px] text-blue-600">smart_toy</span>
                      <span>Simulate Counterparty (Sandbox)</span>
                    </button>
                  )}

                  {deal.status === "tentative_agreement" && (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={signBusy}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 text-zinc-900 font-sans text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">draw</span>
                      <span>{signBusy ? "Affirming..." : "Affirm & Sign Contract"}</span>
                    </button>
                  )}

                  {isClosed && (
                    <Link
                      href={`/deals/${deal.id}/reveal`}
                      className="glossy-btn-blue px-5 py-2.5 rounded-xl font-sans text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
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
            {isAwaitingCounterparty && (
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

            {/* Both Parties Ready Banner */}
            {bothPartiesReady && deal.status === "open" && events.length === 0 && (
              <div className="p-4.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border border-blue-200/80 text-blue-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-blue-950 flex items-center gap-2">
                      Both Parties Ready — AI Agents Standing By
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-mono font-bold">
                        Bilateral Mandates Sealed
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5">
                      Both <strong>{buyerName}</strong> and <strong>{sellerName}</strong> have authorized their sealed parameters. Start automated bilateral negotiation or step turn-by-turn.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleNextTurn()}
                    disabled={isSubmittingTurn}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    {isSubmittingTurn ? "Evaluating..." : "Step Opening Bid"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPlaying(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                    Auto-Negotiate (AI)
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
              <div className="glass-panel-elevated p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700/60 flex items-center justify-center text-blue-600 font-black text-base shadow-xs">
                    {(buyerName || "Buyer").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-zinc-950 text-sm tracking-tight">
                      Buyer Agent ({buyerName})
                    </h3>
                    <span className="font-mono text-xs text-slate-500">
                      {latestBuyerModel || "Autonomous Buyer Agent"}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/60 text-slate-700 font-bold">
                  Buyer Role
                </span>
              </div>

              {/* Buyer Offers Stream */}
              <div
                ref={buyerStreamRef}
                className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent rounded-2xl"
              >
                {events
                  .filter((e) => e.actor.includes("buyer"))
                  .map((ev, idx) => {
                    const isBlocked = ev.type === "blocked";
                    const p = ev.payload || {};

                    if (isBlocked) {
                      return (
                        <div key={ev.id || idx} className="rounded-2xl bg-rose-50/80 border border-rose-200 p-4 shadow-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-rose-700">Turn Blocked by Kernel</span>
                            <span className="text-rose-600 font-mono text-xs">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-rose-700 font-mono">
                            {p.blocked_reason || "Offer violated sealed mandate limits."}
                          </p>
                        </div>
                      );
                    }

                    const displayPrice = p.price ?? (ev.type === "accept" && standingOffer?.price != null ? standingOffer.price : (deal.tentativeTerms?.price ?? "—"));
                    const displayDays = p.delivery_days ?? (ev.type === "accept" && standingOffer?.delivery_days != null ? standingOffer.delivery_days : (deal.tentativeTerms?.delivery_days ?? "—"));
                    const displayRevs = p.revisions ?? (ev.type === "accept" && standingOffer?.revisions != null ? standingOffer.revisions : (deal.tentativeTerms?.revisions ?? "—"));
                    const displayDeposit = p.deposit_pct != null
                      ? `${p.deposit_pct}%`
                      : ev.type === "accept" && standingOffer?.deposit_pct != null
                      ? `${standingOffer.deposit_pct}%`
                      : deal.tentativeTerms?.deposit_pct != null
                      ? `${deal.tentativeTerms.deposit_pct}%`
                      : "—";

                    return (
                      <div key={ev.id || idx} className="banner-offer-card p-4.5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-700 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            Turn #{ev.seq} · {ev.type === "accept" ? "Acceptance" : "Offer"}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 py-2 px-3 bg-white/70 border border-zinc-200 rounded-xl text-center font-mono text-xs shadow-2xs">
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Price</span>
                            <span className="font-black text-zinc-950 text-sm">
                              {typeof displayPrice === "number" ? `$${displayPrice}` : displayPrice}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Days</span>
                            <span className="font-bold text-zinc-800">
                              {typeof displayDays === "number" ? `${displayDays}d` : displayDays}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Revs</span>
                            <span className="font-bold text-zinc-800">{displayRevs}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Deposit</span>
                            <span className="font-bold text-zinc-800">{displayDeposit}</span>
                          </div>
                        </div>
                        {p.message && (
                          <p className="text-xs text-slate-600 italic leading-relaxed">
                            &ldquo;{p.message}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}

                {events.filter((e) => e.actor.includes("buyer")).length === 0 && (
                  <div className="p-6 banner-offer-card text-center text-xs font-mono border-dashed flex flex-col items-center justify-center gap-2.5">
                    <span className="text-slate-500 font-sans font-medium">Awaiting opening bid from buyer agent...</span>
                    {bothPartiesReady && deal.status === "open" && (
                      <button
                        type="button"
                        onClick={() => handleNextTurn(undefined, "buyer_agent")}
                        disabled={isSubmittingTurn}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-mono text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">smart_toy</span>
                        Dispatch Buyer Opening Bid
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Referee Kernel Column (2 Cols) */}
            <div className="lg:col-span-2 flex flex-col items-center gap-4">
              <div className="w-full glass-panel-elevated rounded-2xl p-5 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700/60 flex items-center justify-center mb-2 text-blue-600 shadow-xs">
                  <span className="material-symbols-outlined text-[22px]">gavel</span>
                </div>
                <h4 className="font-sans font-black text-zinc-950 text-sm tracking-tight">Settlement Kernel</h4>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-bold">Deterministic Check</span>

                <div className="mt-4 pt-3 border-t border-slate-100/80 w-full space-y-2 text-left font-mono text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Round:</span>
                    <span className="font-black text-zinc-950">{roundCount} / {maxRounds}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Standing:</span>
                    <span className="font-black text-blue-700">
                      {standingOffer ? `$${standingOffer.price}` : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Leak Guard:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                </div>

                {bothPartiesReady && deal.status === "open" && (
                  <div className="mt-4 pt-3 border-t border-slate-100/80 w-full flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoPlaying(!autoPlaying)}
                      className={`w-full py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                        autoPlaying
                          ? "bg-amber-500 text-zinc-900 hover:bg-amber-600"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {autoPlaying ? "pause" : "smart_toy"}
                      </span>
                      {autoPlaying ? "Pause Auto" : "Auto-Negotiate (AI)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextTurn()}
                      disabled={isSubmittingTurn}
                      className="w-full py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                      {isSubmittingTurn ? "Evaluating..." : "Step 1 Turn"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Seller Agent Column (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="glass-panel-elevated p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-blue-600 to-blue-800 border border-blue-500 flex items-center justify-center text-zinc-900 font-black text-base shadow-xs">
                    {(sellerName || "Seller").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-zinc-950 text-sm tracking-tight">
                      Seller Agent ({sellerName})
                    </h3>
                    <span className="font-mono text-xs text-slate-500">
                      {latestSellerModel || "Autonomous Seller Agent"}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200/60 text-blue-700 font-bold">
                  Seller Role
                </span>
              </div>

              {/* Seller Offers Stream */}
              <div
                ref={sellerStreamRef}
                className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent rounded-2xl"
              >
                {events
                  .filter((e) => e.actor.includes("seller"))
                  .map((ev, idx) => {
                    const isBlocked = ev.type === "blocked";
                    const p = ev.payload || {};

                    if (isBlocked) {
                      return (
                        <div key={ev.id || idx} className="rounded-2xl bg-rose-50/80 border border-rose-200 p-4 shadow-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-rose-700">Turn Blocked by Kernel</span>
                            <span className="text-rose-600 font-mono text-xs">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-rose-700 font-mono">
                            {p.blocked_reason || "Offer violated sealed mandate limits."}
                          </p>
                        </div>
                      );
                    }

                    const displayPrice = p.price ?? (ev.type === "accept" && standingOffer?.price != null ? standingOffer.price : (deal.tentativeTerms?.price ?? "—"));
                    const displayDays = p.delivery_days ?? (ev.type === "accept" && standingOffer?.delivery_days != null ? standingOffer.delivery_days : (deal.tentativeTerms?.delivery_days ?? "—"));
                    const displayRevs = p.revisions ?? (ev.type === "accept" && standingOffer?.revisions != null ? standingOffer.revisions : (deal.tentativeTerms?.revisions ?? "—"));
                    const displayDeposit = p.deposit_pct != null
                      ? `${p.deposit_pct}%`
                      : ev.type === "accept" && standingOffer?.deposit_pct != null
                      ? `${standingOffer.deposit_pct}%`
                      : deal.tentativeTerms?.deposit_pct != null
                      ? `${deal.tentativeTerms.deposit_pct}%`
                      : "—";

                    return (
                      <div key={ev.id || idx} className="banner-offer-card p-4.5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Turn #{ev.seq} · {ev.type === "accept" ? "Acceptance" : "Offer"}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 py-2 px-3 bg-white/70 border border-zinc-200 rounded-xl text-center font-mono text-xs shadow-2xs">
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Price</span>
                            <span className="font-black text-zinc-950 text-sm">
                              {typeof displayPrice === "number" ? `$${displayPrice}` : displayPrice}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Days</span>
                            <span className="font-bold text-zinc-800">
                              {typeof displayDays === "number" ? `${displayDays}d` : displayDays}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Revs</span>
                            <span className="font-bold text-zinc-800">{displayRevs}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Deposit</span>
                            <span className="font-bold text-zinc-800">{displayDeposit}</span>
                          </div>
                        </div>
                        {p.message && (
                          <p className="text-xs text-slate-600 italic leading-relaxed">
                            &ldquo;{p.message}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}

                {events.filter((e) => e.actor.includes("seller")).length === 0 && (
                  <div className="p-6 banner-offer-card text-center text-xs font-mono border-dashed flex flex-col items-center justify-center gap-2.5">
                    <span className="text-slate-500 font-sans font-medium">Awaiting opening bid from seller agent...</span>
                    {bothPartiesReady && deal.status === "open" && (
                      <button
                        type="button"
                        onClick={() => handleNextTurn(undefined, "seller_agent")}
                        disabled={isSubmittingTurn}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-mono text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">smart_toy</span>
                        Dispatch Seller Opening Bid
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Audit Log / Event Stream */}
          <section className="glass-panel-elevated rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-zinc-100 text-blue-600 flex items-center justify-center border border-zinc-200">
                  <span className="material-symbols-outlined text-[18px]">terminal</span>
                </div>
                <h3 className="font-sans font-black text-zinc-950 text-sm tracking-tight">Negotiation Audit Event Stream</h3>
              </div>
              <span className="font-mono text-xs text-slate-500 font-semibold">{events.length} recorded events</span>
            </div>

            <div
              ref={auditLogRef}
              className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 font-mono text-xs text-zinc-700 max-h-52 overflow-y-auto space-y-2 shadow-inner"
            >
              {events.length === 0 ? (
                <div className="text-slate-500 italic">No events recorded in this negotiation room yet.</div>
              ) : (
                events.map((ev, idx) => (
                  <div key={ev.id || idx} className="flex items-start gap-2.5">
                    <span className="text-slate-500 shrink-0 font-medium">
                      [{new Date(ev.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="text-blue-600 font-bold shrink-0">
                      #{ev.seq} {ev.actor}
                    </span>
                    <span className="text-zinc-700">
                      {ev.type === "offer"
                        ? `proposed price $${ev.payload?.price}, ${ev.payload?.delivery_days}d delivery, ${ev.payload?.revisions} rev, ${ev.payload?.deposit_pct}% deposit`
                        : ev.type === "accept"
                        ? `accepted standing offer: $${ev.payload?.price ?? standingOffer?.price ?? (deal.tentativeTerms?.price ?? "")}`
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-zinc-900 font-bold"
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
