"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toDealData, DealData } from "@/lib/deal-store";
import { Bell, PenLine, UserPlus } from "lucide-react";

interface Notice {
  dealId: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}

export default function NotificationsPage() {
  const convexDeals = useQuery(api.deals.list);
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

  const notices: Notice[] = (convexDeals ?? [])
    .map((d) => toDealData(d as Record<string, unknown>))
    .flatMap((d: DealData) => {
      const myRole = roleMap[d.id] as "buyer" | "seller" | undefined;
      const out: Notice[] = [];
      if (d.status === "setup" && myRole) {
        out.push({
          dealId: d.id,
          icon: <UserPlus className="h-4 w-4" />,
          title: "Waiting for counterparty",
          body: `"${d.title}" — share your Magic Deal Link to start.`,
        });
      }
      if (d.status === "tentative_agreement" && myRole && !d.confirmations[myRole]) {
        out.push({
          dealId: d.id,
          icon: <PenLine className="h-4 w-4" />,
          title: "Signature needed",
          body: `"${d.title}" — agents reached tentative terms. Review and sign.`,
        });
      }
      return out;
    });

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      <main className="container mx-auto px-4 sm:px-6 py-8 pb-8 max-w-3xl space-y-6 flex-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Notifications</h1>
          <p className="text-xs text-slate-500 mt-1">Things that need your action right now.</p>
        </div>

        {notices.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-2xs">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">All caught up</h3>
            <p className="text-xs text-slate-500">Nothing needs your action right now.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 shadow-2xs">
            {notices.map((n, i) => (
              <Link
                key={`${n.dealId}-${i}`}
                href={`/deals/${n.dealId}`}
                className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors"
              >
                <span className="mt-0.5 h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                  {n.icon}
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">{n.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{n.body}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
