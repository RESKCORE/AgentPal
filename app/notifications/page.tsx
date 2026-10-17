"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DealStore, toDealData, type DealData } from "@/lib/deal-store";
import { Bell, PenLine, UserPlus, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

interface Notice {
  dealId: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  badge: string;
  badgeColor: string;
}

const EMPTY_DEALS: DealData[] = [];
const getEmptyDeals = () => EMPTY_DEALS;

export default function NotificationsPage() {
  const convexDeals = useQuery(api.deals.list);
  const localDeals = useSyncExternalStore(
    DealStore.subscribe,
    DealStore.getDeals,
    getEmptyDeals
  );

  const [roleMap] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    const map: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("agentpal_role_")) {
        map[key.replace("agentpal_role_", "")] = window.localStorage.getItem(key) ?? "";
      }
    }
    return map;
  });

  const deals: DealData[] = useMemo(() => {
    if (convexDeals && convexDeals.length > 0) {
      return (convexDeals as Record<string, unknown>[]).map(toDealData);
    }
    return localDeals;
  }, [convexDeals, localDeals]);

  const notices: Notice[] = useMemo(() => {
    return deals.flatMap((d: DealData) => {
      const myRole = roleMap[d.id] as "buyer" | "seller" | undefined;
      const out: Notice[] = [];
      if (d.status === "setup" && myRole) {
        out.push({
          dealId: d.id,
          icon: <UserPlus className="h-5 w-5 text-blue-600" />,
          title: "Waiting for Counterparty",
          body: `"${d.title}" — Share your Magic Deal Link with the other party to initiate negotiation.`,
          badge: "Awaiting Counterparty",
          badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/30",
        });
      }
      if (d.status === "tentative_agreement" && myRole && !d.confirmations[myRole]) {
        out.push({
          dealId: d.id,
          icon: <PenLine className="h-5 w-5 text-amber-400" />,
          title: "Cryptographic Signature Required",
          body: `"${d.title}" — AI agents reached tentative terms. Review final terms and authorize signature.`,
          badge: "Action Required",
          badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        });
      }
      return out;
    });
  }, [deals, roleMap]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans relative overflow-hidden">
      {/* Background radial gradient inspired by banner.png */}
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(59, 130, 246, 0.15) 45%, transparent 70%)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-15" />

      <main className="container mx-auto px-4 sm:px-6 py-8 pb-16 max-w-4xl space-y-8 flex-1 relative z-10">
        {/* Header section with architectural kicker */}
        <div className="border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[11px] font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
            Active Alerts · Protocol Events
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 font-outfit">
            Notifications
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Real-time pending signatures, magic link invitations, and escrow milestones requiring your authorization.
          </p>
        </div>

        {notices.length === 0 ? (
          <div className="glass-panel-dark-elevated rounded-3xl p-16 text-center space-y-4 border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="h-16 w-16 rounded-2xl bg-zinc-100 border border-zinc-200 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold font-outfit text-zinc-900">All caught up</h3>
            <p className="text-sm text-zinc-600 max-w-sm mx-auto">
              No pending signatures, escrow approvals, or actions required at this moment.
            </p>
            <div className="pt-2">
              <Link
                href="/deals/new"
                className="glossy-btn-blue text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
              >
                <span>Create New Deal</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((n, i) => (
              <Link
                key={`${n.dealId}-${i}`}
                href={`/deals/${n.dealId}`}
                className="glass-panel-dark-elevated rounded-2xl p-5 border border-zinc-200 hover:border-blue-500/40 transition-all flex items-start gap-4 group"
              >
                <div className="h-12 w-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                  {n.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors font-outfit">
                      {n.title}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${n.badgeColor}`}>
                      {n.badge}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {n.body}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 mt-2">
                    Deal Room #{n.dealId}
                  </span>
                </div>

                <div className="h-8 w-8 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-600 group-hover:text-zinc-900 group-hover:bg-blue-500 flex items-center justify-center shrink-0 transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
