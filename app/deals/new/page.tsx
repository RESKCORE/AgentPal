"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShareLinkModal } from "@/components/deal-room/share-link-modal";
import { DealStore } from "@/lib/deal-store";

type CreatorRole = "buyer" | "seller";

export default function NewDealPage() {
  const router = useRouter();
  const createDealWithInvite = useMutation(api.deals.createDealWithInvite);
  const [creatorRole, setCreatorRole] = useState<CreatorRole>("buyer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxRounds] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<{ dealId: string; url: string } | null>(null);

  // Mandate state for the creator
  const [priceMin, setPriceMin] = useState(200);
  const [priceMax, setPriceMax] = useState(350);
  const [deliveryMin, setDeliveryMin] = useState(3);
  const [deliveryMax, setDeliveryMax] = useState(7);
  const [revisionsMin, setRevisionsMin] = useState(1);
  const [revisionsMax, setRevisionsMax] = useState(3);
  const [depositMin, setDepositMin] = useState(20);
  const [depositMax, setDepositMax] = useState(30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // Validation
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("A deal title is required.");
      return;
    }

    if (isNaN(priceMin) || isNaN(priceMax) || priceMin <= 0 || priceMax <= 0) {
      setError("Prices must be valid positive numbers.");
      return;
    }

    if (priceMin > priceMax) {
      setError(`Minimum price ($${priceMin}) cannot exceed maximum price ($${priceMax}).`);
      return;
    }

    if (isNaN(deliveryMin) || isNaN(deliveryMax) || deliveryMin <= 0 || deliveryMax <= 0) {
      setError("Delivery days must be positive integers.");
      return;
    }

    if (deliveryMin > deliveryMax) {
      setError(`Minimum delivery days (${deliveryMin}) cannot exceed maximum days (${deliveryMax}).`);
      return;
    }

    if (isNaN(revisionsMin) || isNaN(revisionsMax) || revisionsMin < 0 || revisionsMax < 0) {
      setError("Revisions must be non-negative integers.");
      return;
    }

    if (revisionsMin > revisionsMax) {
      setError(`Minimum revisions (${revisionsMin}) cannot exceed maximum revisions (${revisionsMax}).`);
      return;
    }

    if (isNaN(depositMin) || isNaN(depositMax) || depositMin < 0 || depositMax > 100) {
      setError("Deposit percentages must be between 0% and 100%.");
      return;
    }

    if (depositMin > depositMax) {
      setError(`Minimum deposit (${depositMin}%) cannot exceed maximum deposit (${depositMax}%).`);
      return;
    }

    setSubmitting(true);
    try {
      const { dealId, inviteToken } = await createDealWithInvite({
        title: cleanTitle,
        description: description.trim() || cleanTitle,
        creatorRole,
        maxRounds,
        mandate: {
          role: creatorRole,
          price_min: priceMin,
          price_max: priceMax,
          delivery_days_min: deliveryMin,
          delivery_days_max: deliveryMax,
          revisions_min: revisionsMin,
          revisions_max: revisionsMax,
          deposit_pct_min: depositMin,
          deposit_pct_max: depositMax,
        },
      });
      window.localStorage.setItem(`agentpal_role_${dealId}`, creatorRole);
      const url = `${window.location.origin}/deals/${dealId}/join?token=${inviteToken}`;
      setShare({ dealId, url });
    } catch (err) {
      // Local DealStore fallback if offline or backend unauthenticated
      try {
        const localDeal = DealStore.createDeal(
          cleanTitle,
          description.trim() || cleanTitle,
          creatorRole === "buyer"
            ? { role: "buyer", price_min: priceMin, price_max: priceMax, delivery_days_min: deliveryMin, delivery_days_max: deliveryMax, revisions_min: revisionsMin, revisions_max: revisionsMax, deposit_pct_min: depositMin, deposit_pct_max: depositMax }
            : { role: "buyer", price_min: Math.max(50, priceMin - 50), price_max: priceMax, delivery_days_min: deliveryMin, delivery_days_max: deliveryMax, revisions_min: revisionsMin, revisions_max: revisionsMax, deposit_pct_min: depositMin, deposit_pct_max: depositMax },
          creatorRole === "seller"
            ? { role: "seller", price_min: priceMin, price_max: priceMax, delivery_days_min: deliveryMin, delivery_days_max: deliveryMax, revisions_min: revisionsMin, revisions_max: revisionsMax, deposit_pct_min: depositMin, deposit_pct_max: depositMax }
            : undefined,
          "",
          "",
          maxRounds
        );
        localDeal.creatorRole = creatorRole;
        DealStore.saveDeal(localDeal);
        window.localStorage.setItem(`agentpal_role_${localDeal.id}`, creatorRole);
        const url = `${window.location.origin}/deals/${localDeal.id}`;
        setShare({ dealId: localDeal.id, url });
      } catch {
        setError(err instanceof Error ? err.message : "Could not create the deal link.");
      }
    } finally {
      setSubmitting(false);
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
        <div className="w-full px-4 lg:px-8 py-8 flex flex-col gap-6 max-w-[1200px] mx-auto">
          {/* Breadcrumb / Navigation */}
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-600">
            <Link href="/" className="hover:text-zinc-900 font-bold transition-colors">
              Dashboard
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-blue-600 font-bold">Create New Deal Room</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight font-outfit">
              Create Deal Room
            </h1>
            <p className="text-sm text-zinc-600">
              Define your negotiation terms and private mandate limits. Your bounds remain strictly sealed from the counterparty.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-800 text-xs font-semibold shadow-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* General Deal Information */}
            <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 space-y-5 border border-zinc-200">
              <h2 className="text-base font-black text-zinc-900 pb-3 border-b border-zinc-200 tracking-tight">
                Deal Overview
              </h2>

              <div className="space-y-1.5">
                <label htmlFor="deal-title" className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">
                  Deal Title *
                </label>
                <input
                  id="deal-title"
                  type="text"
                  placeholder="e.g. Brand Identity & Design System"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="deal-description" className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">
                  Scope &amp; Deliverables
                </label>
                <textarea
                  id="deal-description"
                  placeholder="Briefly describe what is being negotiated, key requirements, and deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-100 border border-zinc-200 rounded-xl p-4 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none transition-all placeholder:text-zinc-500"
                />
              </div>

              {/* Creator Role Selector */}
              <div className="pt-2">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider block mb-2.5">
                  Your Role in this Deal
                </span>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setCreatorRole("buyer")}
                    className={`py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all ${
                      creatorRole === "buyer"
                        ? "glossy-btn-dark shadow-sm border-blue-500/50 text-blue-600"
                        : "bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
                    }`}
                  >
                    Buyer (Purchasing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorRole("seller")}
                    className={`py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all ${
                      creatorRole === "seller"
                        ? "glossy-btn-dark shadow-sm border-blue-500/50 text-blue-600"
                        : "bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
                    }`}
                  >
                    Seller (Delivering)
                  </button>
                </div>
              </div>
            </div>

            {/* Private Mandate Limits Card */}
            <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 space-y-6 border border-zinc-200">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200">
                <div>
                  <h2 className="text-base font-black text-zinc-900 tracking-tight">
                    Your Sealed Private Mandate ({creatorRole === "buyer" ? "Buyer" : "Seller"})
                  </h2>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Your agent will never offer or accept terms outside these boundaries.
                  </p>
                </div>
                <span className="glossy-pill px-3 py-1 rounded-full text-zinc-800 font-mono text-xs font-bold border border-zinc-200 bg-zinc-100">
                  🔒 Sealed
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-xs">
                {/* Price bounds */}
                <div className="p-4.5 bg-zinc-100 border border-zinc-200 rounded-2xl space-y-3">
                  <span className="font-bold text-zinc-900 block uppercase tracking-wide">Price Boundary ($ USD)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="price-min" className="text-zinc-600 text-[11px] block mb-1">
                        {creatorRole === "buyer" ? "Target Min ($)" : "Absolute Floor ($)"}
                      </label>
                      <input
                        id="price-min"
                        type="number"
                        min="1"
                        value={priceMin}
                        onChange={(e) => setPriceMin(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="price-max" className="text-zinc-600 text-[11px] block mb-1">
                        {creatorRole === "buyer" ? "Absolute Cap ($)" : "Target Max ($)"}
                      </label>
                      <input
                        id="price-max"
                        type="number"
                        min="1"
                        value={priceMax}
                        onChange={(e) => setPriceMax(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery days bounds */}
                <div className="p-4.5 bg-zinc-100 border border-zinc-200 rounded-2xl space-y-3">
                  <span className="font-bold text-zinc-900 block uppercase tracking-wide">Delivery Timeline (Days)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="delivery-min" className="text-zinc-600 text-[11px] block mb-1">Min Days</label>
                      <input
                        id="delivery-min"
                        type="number"
                        min="1"
                        value={deliveryMin}
                        onChange={(e) => setDeliveryMin(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="delivery-max" className="text-zinc-600 text-[11px] block mb-1">Max Days</label>
                      <input
                        id="delivery-max"
                        type="number"
                        min="1"
                        value={deliveryMax}
                        onChange={(e) => setDeliveryMax(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Revisions bounds */}
                <div className="p-4.5 bg-zinc-100 border border-zinc-200 rounded-2xl space-y-3">
                  <span className="font-bold text-zinc-900 block uppercase tracking-wide">Revision Rounds</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rev-min" className="text-zinc-600 text-[11px] block mb-1">Min Rounds</label>
                      <input
                        id="rev-min"
                        type="number"
                        min="0"
                        value={revisionsMin}
                        onChange={(e) => setRevisionsMin(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="rev-max" className="text-zinc-600 text-[11px] block mb-1">Max Rounds</label>
                      <input
                        id="rev-max"
                        type="number"
                        min="0"
                        value={revisionsMax}
                        onChange={(e) => setRevisionsMax(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Deposit bounds */}
                <div className="p-4.5 bg-zinc-100 border border-zinc-200 rounded-2xl space-y-3">
                  <span className="font-bold text-zinc-900 block uppercase tracking-wide">Deposit Upfront (%)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="dep-min" className="text-zinc-600 text-[11px] block mb-1">Min Deposit %</label>
                      <input
                        id="dep-min"
                        type="number"
                        min="0"
                        max="100"
                        value={depositMin}
                        onChange={(e) => setDepositMin(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="dep-max" className="text-zinc-600 text-[11px] block mb-1">Max Deposit %</label>
                      <input
                        id="dep-max"
                        type="number"
                        min="0"
                        max="100"
                        value={depositMax}
                        onChange={(e) => setDepositMax(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/"
                className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-4 py-2.5 rounded-xl text-zinc-700 hover:text-zinc-900 font-mono text-xs font-bold transition-all"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={submitting}
                className="glossy-btn-dark px-7 py-3 rounded-xl font-mono text-xs font-bold tracking-wider uppercase shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? "Sealing Mandate & Generating Link..." : "Create Deal & Generate Invite"}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Magic Deal Link Modal */}
      {share && (
        <ShareLinkModal
          open={Boolean(share)}
          url={share.url}
          onEnterRoom={() => router.push(`/deals/${share.dealId}`)}
        />
      )}
    </div>
  );
}
