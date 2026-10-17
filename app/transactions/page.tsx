"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DealStore, toDealData, type DealData } from "@/lib/deal-store";
import { 
  Receipt, 
  ArrowUpRight, 
  ShieldCheck, 
  ExternalLink, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  FileText 
} from "lucide-react";

interface TxRow {
  dealId: string;
  dealTitle: string;
  invoiceId: string;
  kind: string;
  amount: number;
  status: string;
  recipient: string;
  createdAt?: string;
  paidAt?: string;
}

const EMPTY_DEALS: DealData[] = [];
const getEmptyDeals = () => EMPTY_DEALS;

export default function TransactionsPage() {
  const convexDeals = useQuery(api.deals.list);
  const localDeals = useSyncExternalStore(
    DealStore.subscribe,
    DealStore.getDeals,
    getEmptyDeals
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");

  // Dual data source: Convex with seamless fallback to DealStore
  const deals: DealData[] = useMemo(() => {
    if (convexDeals && convexDeals.length > 0) {
      return (convexDeals as Record<string, unknown>[]).map(toDealData);
    }
    return localDeals;
  }, [convexDeals, localDeals]);

  const rows: TxRow[] = useMemo(() => {
    return deals
      .filter((d) => d.paypalInvoice)
      .map((d) => ({
        dealId: d.id,
        dealTitle: d.title,
        invoiceId: d.paypalInvoice!.invoiceId,
        kind: d.paypalInvoice!.kind ?? "deposit",
        amount: d.paypalInvoice!.amount,
        status: d.paypalInvoice!.status,
        recipient: d.paypalInvoice!.recipientEmail,
        createdAt: d.paypalInvoice!.createdAt,
        paidAt: d.paypalInvoice!.paidAt,
      }));
  }, [deals]);

  // Aggregate metrics
  const totalVolume = rows.reduce((acc, r) => acc + r.amount, 0);
  const paidRows = rows.filter((r) => r.status === "PAID");
  const paidVolume = paidRows.reduce((acc, r) => acc + r.amount, 0);
  const pendingCount = rows.length - paidRows.length;

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "PAID" && r.status !== "PAID") return false;
      if (statusFilter === "PENDING" && r.status === "PAID") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.dealTitle.toLowerCase().includes(q) ||
          r.invoiceId.toLowerCase().includes(q) ||
          r.recipient.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

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

      <main className="container mx-auto px-4 sm:px-6 py-8 pb-16 max-w-6xl space-y-8 flex-1 relative z-10">
        {/* Header section with architectural kicker */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[11px] font-bold uppercase tracking-wider mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
              PayPal Sandbox Protocol · Zero-LLM Settlement
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 font-outfit">
              Financial Ledger
            </h1>
            <p className="text-sm text-zinc-600 mt-1 max-w-xl">
              Cryptographically verified deposit escrow, milestone settlements, and sandbox invoices generated upon dual-agent agreement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/deals/new"
              className="glossy-btn-blue text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2"
            >
              <span>Negotiate Deal</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* 4 Banner-style metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel-dark p-5 rounded-2xl relative overflow-hidden group">
            <div className="pointer-events-none absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
            <div className="flex items-center justify-between text-zinc-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Total Volume</span>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-outfit text-zinc-900 tracking-tight">
              ${totalVolume.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 font-mono">
              Across {rows.length} total invoice{rows.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="glass-panel-dark p-5 rounded-2xl relative overflow-hidden group">
            <div className="pointer-events-none absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="flex items-center justify-between text-zinc-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Settled (Paid)</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-outfit text-emerald-600 tracking-tight">
              ${paidVolume.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 font-mono">
              {paidRows.length} deal{paidRows.length !== 1 ? "s" : ""} funded in Sandbox
            </div>
          </div>

          <div className="glass-panel-dark p-5 rounded-2xl relative overflow-hidden group">
            <div className="pointer-events-none absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
            <div className="flex items-center justify-between text-zinc-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Pending Deposit</span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-outfit text-amber-600 tracking-tight">
              {pendingCount}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 font-mono">
              Awaiting counterparty payment
            </div>
          </div>

          <div className="glass-panel-dark p-5 rounded-2xl relative overflow-hidden group">
            <div className="pointer-events-none absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors" />
            <div className="flex items-center justify-between text-zinc-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Environment</span>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-outfit text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Sandbox</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 font-mono font-medium">
                Live
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 font-mono">
              api.sandbox.paypal.com
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="glass-panel-dark p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "ALL"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              All Invoices ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PAID")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "PAID"
                  ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              Paid ({paidRows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "PENDING"
                  ? "bg-amber-500 text-zinc-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, invoice ID, email..."
              className="w-full bg-zinc-100 border border-zinc-200 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Transactions Table or Empty State */}
        {filteredRows.length === 0 ? (
          <div className="glass-panel-dark-elevated rounded-3xl p-16 text-center space-y-4 border border-zinc-200">
            <div className="h-16 w-16 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-600 flex items-center justify-center mx-auto shadow-inner">
              <Receipt className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold font-outfit text-zinc-900">No transactions found</h3>
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              {rows.length === 0
                ? "Once buyer and seller agents conclude negotiations with matching terms, safe PayPal Sandbox escrow invoices will populate here."
                : "No transactions match your current search or status filter."}
            </p>
            {rows.length === 0 && (
              <div className="pt-2">
                <Link
                  href="/deals/new"
                  className="glossy-btn-blue text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
                >
                  <span>Start New Negotiation</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel-dark-elevated rounded-3xl overflow-hidden border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 font-bold uppercase text-[11px] tracking-wider font-mono">
                    <th className="py-4 px-6">Deal Room</th>
                    <th className="py-4 px-4">Invoice ID</th>
                    <th className="py-4 px-4">Type</th>
                    <th className="py-4 px-4">Escrow Amount</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4">Recipient</th>
                    <th className="py-4 px-6 text-right">Settlement Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-sans">
                  {filteredRows.map((r) => {
                    const isPaid = r.status === "PAID";
                    return (
                      <tr 
                        key={`${r.dealId}-${r.invoiceId}`} 
                        className="hover:bg-zinc-50 transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <Link 
                            href={`/deals/${r.dealId}`}
                            className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors flex items-center gap-2"
                          >
                            <span>{r.dealTitle}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                          </Link>
                          <span className="text-[11px] font-mono text-zinc-500">
                            #{r.dealId}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-mono text-zinc-700 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200">
                            {r.invoiceId}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="capitalize text-zinc-700 font-medium flex items-center gap-1.5">
                            <FileText className="h-3 w-3 text-zinc-500" />
                            {r.kind}
                          </span>
                        </td>

                        <td className="py-4 px-4 font-mono font-bold text-sm text-zinc-900">
                          <span className="text-zinc-600">$</span>{r.amount}
                        </td>

                        <td className="py-4 px-4">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                              PAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              INVOICED
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 font-mono text-[11px] text-zinc-600">
                          {r.recipient || "sandbox-recipient@paypal.com"}
                        </td>

                        <td className="py-4 px-6 text-right font-mono text-xs text-zinc-600">
                          {r.paidAt ? (
                            <span className="text-emerald-600 font-medium">
                              {new Date(r.paidAt).toLocaleDateString()}
                            </span>
                          ) : r.createdAt ? (
                            new Date(r.createdAt).toLocaleDateString()
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
