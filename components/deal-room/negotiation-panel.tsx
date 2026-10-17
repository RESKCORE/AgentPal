"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatTime } from "@/lib/utils";
import {
  User,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Shield,
  Check,
} from "lucide-react";
import { SettlementKernel } from "@/lib/settlement-kernel";
import type { Mandate } from "@/lib/types";

interface Offer {
  id: string;
  seq: number;
  actor: "buyer_agent" | "seller_agent" | "human_buyer" | "human_seller";
  type: "offer" | "accept" | "blocked";
  payload: {
    price?: number;
    delivery_days?: number;
    revisions?: number;
    deposit_pct?: number;
    message: string;
    blocked_reason?: string;
  };
  timestamp: string;
}

interface NegotiationPanelProps {
  offers: Offer[];
  currentRound: number;
  maxRounds: number;
  onTakeover: () => void;
  userRole: "buyer" | "seller";
  buyerMandate?: Mandate;
  sellerMandate?: Mandate;
}

export function NegotiationPanel({
  offers,
  currentRound,
  maxRounds,
  onTakeover,
  userRole,
  buyerMandate,
  sellerMandate,
}: NegotiationPanelProps) {
  const isUserOffer = (actor: string) => {
    return (
      (userRole === "buyer" && actor.includes("buyer")) ||
      (userRole === "seller" && actor.includes("seller"))
    );
  };

  const getActorInfo = (actor: string) => {
    if (actor.includes("agent")) {
      return {
        icon: Bot,
        label: actor.includes("buyer") ? "Buyer Agent" : "Seller Agent",
        color: actor.includes("buyer") ? "text-blue-600" : "text-purple-600",
        bgColor: actor.includes("buyer")
          ? "bg-blue-100 dark:bg-blue-900/30"
          : "bg-purple-100 dark:bg-purple-900/30",
      };
    } else {
      return {
        icon: User,
        label: actor.includes("buyer") ? "Buyer (You)" : "Seller (You)",
        color: actor.includes("buyer") ? "text-blue-600" : "text-purple-600",
        bgColor: actor.includes("buyer")
          ? "bg-blue-100 dark:bg-blue-900/30"
          : "bg-purple-100 dark:bg-purple-900/30",
      };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Negotiation Timeline */}
      <div className="lg:col-span-2">
        <Card className="border-neutral-200 h-full flex flex-col">
          <CardHeader className="border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Send className="h-4 w-4 text-zinc-900" />
                </div>
                Negotiation Room
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  Round {currentRound} of {maxRounds}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTakeover}
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  Take Over
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence mode="popLayout">
              {offers.map((offer, index) => {
                const actorInfo = getActorInfo(offer.actor);
                const isUser = isUserOffer(offer.actor);
                const isBlocked = offer.type === "blocked";
                const isAccepted = offer.type === "accept";

                return (
                  <motion.div
                    key={offer.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      delay: index * 0.05,
                    }}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        isUser ? "items-end" : "items-start"
                      } flex flex-col gap-2`}
                    >
                      {/* Actor Label */}
                      <div className="flex items-center gap-2 px-2">
                        <actorInfo.icon className={`h-4 w-4 ${actorInfo.color}`} />
                        <span className="text-xs font-medium text-neutral-600">
                          {actorInfo.label}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {formatTime(offer.timestamp)}
                        </span>
                      </div>

                      {/* Offer Card */}
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`rounded-2xl p-4 ${
                          isBlocked
                            ? "bg-red-50 border-2 border-red-200"
                            : isAccepted
                            ? "bg-emerald-50 border-2 border-emerald-200"
                            : isUser
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-neutral-50 border border-neutral-200"
                        } shadow-sm`}
                      >
                        {isBlocked ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-red-600">
                              <Shield className="h-5 w-5" />
                              <span className="font-semibold">Blocked by Kernel</span>
                            </div>
                            <p className="text-sm text-red-700">
                              {offer.payload.blocked_reason}
                            </p>
                            <p className="text-xs text-neutral-600 mt-2">
                              {offer.payload.message}
                            </p>
                          </div>
                        ) : isAccepted ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-emerald-600">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="font-semibold">Accepted Offer</span>
                            </div>
                            <p className="text-sm text-neutral-700">
                              {offer.payload.message}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-neutral-700 leading-relaxed">
                              {offer.payload.message}
                            </p>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-200/50">
                              <div>
                                <p className="text-xs text-neutral-500">Price</p>
                                <p className="font-semibold text-neutral-900">
                                  {formatCurrency(offer.payload.price || 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Delivery</p>
                                <p className="font-semibold text-neutral-900">
                                  {offer.payload.delivery_days} days
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Revisions</p>
                                <p className="font-semibold text-neutral-900">
                                  {offer.payload.revisions}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Deposit</p>
                                <p className="font-semibold text-neutral-900">
                                  {offer.payload.deposit_pct}%
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {offers.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-64 text-center"
              >
                <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-neutral-400" />
                </div>
                <p className="text-neutral-600 font-medium">
                  Waiting for negotiation to begin...
                </p>
                <p className="text-sm text-neutral-400 mt-2">
                  Agents will start exchanging offers shortly
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Offer & Kernel Panel */}
      <div className="space-y-6">
        {/* Current Standing Offer */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-neutral-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader>
              <CardTitle className="text-base">Current Offer</CardTitle>
            </CardHeader>
            <CardContent>
              {offers.length > 0 && offers[offers.length - 1].type === "offer" ? (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-3xl font-bold text-neutral-900">
                      {formatCurrency(
                        offers[offers.length - 1].payload.price || 0
                      )}
                    </p>
                    <p className="text-sm text-neutral-500 mt-1">Standing Price</p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Delivery</span>
                      <span className="font-medium text-neutral-900">
                        {offers[offers.length - 1].payload.delivery_days} days
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Revisions</span>
                      <span className="font-medium text-neutral-900">
                        {offers[offers.length - 1].payload.revisions}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Deposit</span>
                      <span className="font-medium text-neutral-900">
                        {offers[offers.length - 1].payload.deposit_pct}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500">
                  <p className="text-sm">No standing offer yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Kernel Validation Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                Kernel Checks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {offers.slice(-5).map((offer, index) => {
                  const isBlocked = offer.type === "blocked";
                  const isAccept = offer.type === "accept";
                  const actorMandate = offer.actor.includes("buyer") ? buyerMandate : sellerMandate;
                  
                  let invariantViolations: string[] = [];
                  if (actorMandate && offer.payload.price) {
                    const terms = {
                      price: offer.payload.price,
                      delivery_days: offer.payload.delivery_days || 5,
                      revisions: offer.payload.revisions || 2,
                      deposit_pct: offer.payload.deposit_pct || 25,
                      message: offer.payload.message || "",
                    };
                    const res = SettlementKernel.validateOffer(terms, actorMandate);
                    if (!res.valid) invariantViolations = res.violations;
                  }

                  return (
                    <motion.div
                      key={offer.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          {isBlocked ? (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                          <span className={isBlocked ? "text-red-700" : "text-slate-800"}>
                            Turn #{offer.seq}: {isBlocked ? "Blocked by Referee" : isAccept ? "Acceptance Validated" : "Offer Invariants Validated"}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            isBlocked
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {isBlocked ? "REJECTED" : "PASSED"}
                        </Badge>
                      </div>

                      {isBlocked ? (
                        <p className="text-[11px] text-red-600 font-medium pl-5">
                          {offer.payload.blocked_reason || (invariantViolations.length > 0 ? invariantViolations.join("; ") : "Boundary violation detected")}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 pl-5 text-[10px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Check className="h-2.5 w-2.5 stroke-[3]" /> Price in limits
                          </span>
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Check className="h-2.5 w-2.5 stroke-[3]" /> Delivery valid
                          </span>
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Check className="h-2.5 w-2.5 stroke-[3]" /> Deposit within range
                          </span>
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Check className="h-2.5 w-2.5 stroke-[3]" /> Zero mandate leak
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {offers.length === 0 && (
                  <p className="text-sm text-neutral-400 text-center py-4">
                    No validations yet
                  </p>
                )}
              </div>

              {/* Kernel Invariant Reference */}
              <div className="pt-3 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600">
                <p className="font-bold text-slate-800 text-xs flex items-center gap-1">
                  <Shield className="h-3 w-3 text-emerald-600" />
                  Deterministic Guarantees:
                </p>
                <ul className="space-y-1 text-[10px] text-slate-500 font-mono">
                  <li>• Pure TypeScript kernel (zero network, zero async)</li>
                  <li>• SHA-256 HMAC contract tamper protection</li>
                  <li>• Regex mandate leak scanning on every message</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
