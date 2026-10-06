"use client";

import { useMemo } from "react";
import { Check, X, Bot, Clock, ArrowUp, ArrowDown } from "lucide-react";

export interface DealEventItem {
  id: string;
  seq: number;
  actor: "buyer_agent" | "seller_agent" | "human_buyer" | "human_seller";
  type: "offer" | "accept" | "blocked" | "takeover" | "contract";
  payload: {
    price?: number;
    delivery_days?: number;
    revisions?: number;
    deposit_pct?: number;
    message?: string;
    blocked_reason?: string;
  };
  timestamp: string;
}

interface TwoLaneTranscriptProps {
  events: DealEventItem[];
  buyerName?: string;
  sellerName?: string;
  isThinking?: boolean;
  thinkingAgent?: "buyer" | "seller";
}

export function TwoLaneTranscript({
  events,
  buyerName = "Buyer",
  sellerName = "Seller",
  isThinking = false,
  thinkingAgent = "buyer",
}: TwoLaneTranscriptProps) {
  // Compute price movements for each offer compared to previous offer by the same side
  const enrichedEvents = useMemo(() => {
    return events.map((evt, idx) => {
      const isBuyer = evt.actor.includes("buyer");
      const currentPrice = evt.payload?.price;

      let changeChip: { diff: number; direction: "up" | "down" } | null = null;

      if (typeof currentPrice === "number" && evt.type !== "blocked") {
        for (let i = idx - 1; i >= 0; i--) {
          const prev = events[i];
          const prevIsBuyer = prev.actor.includes("buyer");
          if (
            prevIsBuyer === isBuyer &&
            prev.type !== "blocked" &&
            typeof prev.payload?.price === "number"
          ) {
            const diff = currentPrice - prev.payload.price;
            if (diff !== 0) {
              changeChip = { diff: Math.abs(diff), direction: diff > 0 ? "up" : "down" };
            }
            break;
          }
        }
      }

      return {
        ...evt,
        isBuyer,
        changeChip,
      };
    });
  }, [events]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Table Headers */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        {/* Desktop 3-column header: Left = Buyer, Center = Referee, Right = Seller */}
        <div
          className="hidden md:grid items-center text-xs font-bold text-slate-700"
          style={{ gridTemplateColumns: "1fr 56px 1fr" }}
        >
          <div className="flex items-center gap-2 pl-2">
            <Bot className="h-4 w-4 text-slate-800" />
            <span>Buyer agent ({buyerName})</span>
          </div>

          <div className="text-center text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            Referee
          </div>

          <div className="flex items-center justify-end gap-2 pr-2 text-right">
            <span>Seller agent ({sellerName})</span>
            <Bot className="h-4 w-4 text-emerald-700" />
          </div>
        </div>

        {/* Mobile single timeline header */}
        <div className="md:hidden flex items-center justify-between text-xs font-bold text-slate-800">
          <span>Negotiation Timeline</span>
          <span className="text-[10px] text-slate-400 font-normal">Referee Verified</span>
        </div>
      </div>

      {/* Transcript Body */}
      <div className="p-4 sm:p-6 space-y-4 min-h-[320px]">
        {enrichedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 text-xs">
            <Clock className="h-8 w-8 mb-2 stroke-[1.5]" />
            <p className="font-semibold text-slate-600">No offers exchanged yet.</p>
            <p className="text-slate-400 mt-0.5">Click &ldquo;Run next turn&rdquo; or &ldquo;Auto-play&rdquo; to start the negotiation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {enrichedEvents.map((evt) => {
              const isBlocked = evt.type === "blocked";
              const isAccept = evt.type === "accept";
              const p = evt.payload;

              return (
                <div key={evt.id} className="relative">
                  {/* Desktop 3-column row */}
                  <div
                    className="hidden md:grid items-center gap-4"
                    style={{ gridTemplateColumns: "1fr 56px 1fr" }}
                  >
                    {/* Left side: Buyer column */}
                    <div className="min-w-0">
                      {evt.isBuyer ? (
                        <div
                          className={`p-3.5 rounded-xl border transition-all ${
                            isBlocked
                              ? "border-2 border-dashed border-rose-300 bg-rose-50/50"
                              : isAccept
                              ? "border-emerald-300 bg-emerald-50/60 shadow-2xs ring-1 ring-emerald-300"
                              : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className={`text-xs font-extrabold ${
                                isBlocked
                                  ? "text-rose-700 line-through italic"
                                  : isAccept
                                  ? "text-emerald-800"
                                  : "text-slate-900"
                              }`}
                            >
                              {isAccept ? "Terms Accepted ✓" : `Offer #${evt.seq}`}
                            </span>
                            {evt.changeChip && !isBlocked && !isAccept && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                {evt.changeChip.direction === "up" ? (
                                  <ArrowUp className="h-2.5 w-2.5" />
                                ) : (
                                  <ArrowDown className="h-2.5 w-2.5" />
                                )}
                                ${evt.changeChip.diff}
                              </span>
                            )}
                          </div>

                          {isBlocked ? (
                            <div className="space-y-1">
                              <p className="text-xs text-rose-800 line-through italic font-mono tabular-nums">
                                ${p.price ?? 900} · {p.delivery_days ?? 0}d · {p.revisions ?? 0} rev
                              </p>
                              <p className="text-[11px] font-bold text-rose-700">
                                {p.blocked_reason || "Blocked: price outside mandate"}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {p.price ? (
                                <div className="text-xs font-semibold text-slate-800 tabular-nums">
                                  ${p.price} · {p.delivery_days}d · {p.revisions} rev · {p.deposit_pct}%
                                </div>
                              ) : null}
                              {p.message && (
                                <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                                  &ldquo;{p.message}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>

                    {/* Center: Referee status icon */}
                    <div className="flex flex-col items-center justify-center">
                      {isBlocked ? (
                        <div
                          className="h-6 w-6 rounded-full bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center shadow-2xs"
                          title="Blocked by Settlement Kernel Referee"
                        >
                          <X className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div
                          className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center justify-center shadow-2xs"
                          title="Verified valid inside private mandate"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Right side: Seller column */}
                    <div className="min-w-0">
                      {!evt.isBuyer ? (
                        <div
                          className={`p-3.5 rounded-xl border transition-all ${
                            isBlocked
                              ? "border-2 border-dashed border-rose-300 bg-rose-50/50"
                              : isAccept
                              ? "border-emerald-300 bg-emerald-50/60 shadow-2xs ring-1 ring-emerald-300"
                              : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className={`text-xs font-extrabold ${
                                isBlocked
                                  ? "text-rose-700 line-through italic"
                                  : isAccept
                                  ? "text-emerald-800"
                                  : "text-slate-900"
                              }`}
                            >
                              {isAccept ? "Terms Accepted ✓" : `Offer #${evt.seq}`}
                            </span>
                            {evt.changeChip && !isBlocked && !isAccept && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                {evt.changeChip.direction === "up" ? (
                                  <ArrowUp className="h-2.5 w-2.5" />
                                ) : (
                                  <ArrowDown className="h-2.5 w-2.5" />
                                )}
                                ${evt.changeChip.diff}
                              </span>
                            )}
                          </div>

                          {isBlocked ? (
                            <div className="space-y-1">
                              <p className="text-xs text-rose-800 line-through italic font-mono tabular-nums">
                                ${p.price ?? 900} · {p.delivery_days ?? 0}d · {p.revisions ?? 0} rev
                              </p>
                              <p className="text-[11px] font-bold text-rose-700">
                                {p.blocked_reason || "Blocked: price outside mandate"}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {p.price ? (
                                <div className="text-xs font-semibold text-slate-800 tabular-nums">
                                  ${p.price} · {p.delivery_days}d · {p.revisions} rev · {p.deposit_pct}%
                                </div>
                              ) : null}
                              {p.message && (
                                <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                                  &ldquo;{p.message}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>
                  </div>

                  {/* Mobile stacked view */}
                  <div className="md:hidden flex items-start gap-3">
                    <div className="pt-2">
                      {isBlocked ? (
                        <div className="h-5 w-5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center">
                          <X className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center justify-center">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div
                      className={`flex-1 p-3.5 rounded-xl border ${
                        isBlocked
                          ? "border-2 border-dashed border-rose-300 bg-rose-50/50"
                          : isAccept
                          ? "border-emerald-300 bg-emerald-50/50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-700">
                          {evt.isBuyer ? `Buyer (${buyerName})` : `Seller (${sellerName})`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {isAccept ? "Accepted" : `Offer #${evt.seq}`}
                        </span>
                      </div>

                      {isBlocked ? (
                        <div>
                          <p className="text-xs text-rose-800 line-through italic tabular-nums font-mono">
                            ${p.price} · {p.delivery_days}d · {p.revisions} rev
                          </p>
                          <p className="text-[11px] font-bold text-rose-700 mt-1">
                            {p.blocked_reason || "Blocked: price outside mandate"}
                          </p>
                        </div>
                      ) : (
                        <div>
                          {p.price ? (
                            <div className="text-xs font-bold text-slate-900 tabular-nums">
                              ${p.price} · {p.delivery_days}d · {p.revisions} rev · {p.deposit_pct}%
                            </div>
                          ) : null}
                          {p.message && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">&ldquo;{p.message}&rdquo;</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Thinking indicator row */}
            {isThinking && (
              <div
                className="hidden md:grid items-center gap-4 pt-2"
                style={{ gridTemplateColumns: "1fr 56px 1fr" }}
              >
                <div>
                  {thinkingAgent === "buyer" && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-600 flex items-center gap-2 animate-pulse">
                      <Bot className="h-4 w-4 text-slate-800 shrink-0" />
                      <span>Buyer agent is thinking...</span>
                    </div>
                  )}
                </div>

                <div className="text-center font-bold text-slate-400 text-xs animate-pulse">
                  ···
                </div>

                <div>
                  {thinkingAgent === "seller" && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-600 flex items-center gap-2 animate-pulse">
                      <Bot className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span>Seller agent is thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile thinking indicator */}
            {isThinking && (
              <div className="md:hidden p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 flex items-center gap-2 animate-pulse">
                <Bot className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>
                  {thinkingAgent === "buyer" ? "Buyer agent is thinking..." : "Seller agent is thinking..."}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
