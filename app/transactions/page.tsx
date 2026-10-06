"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toDealData, type DealData } from "@/lib/deal-store";
import { Receipt } from "lucide-react";

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

export default function TransactionsPage() {
  const convexDeals = useQuery(api.deals.list);

  const rows: TxRow[] = (convexDeals ?? [])
    .map((d: Record<string, unknown>) => toDealData(d))
    .filter((d: DealData) => d.paypalInvoice)
    .map((d: DealData) => ({
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

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      <main className="container mx-auto px-4 sm:px-6 py-8 pb-8 max-w-5xl space-y-6 flex-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Transactions</h1>
          <p className="text-xs text-slate-500 mt-1">PayPal Sandbox invoice & payment ledger.</p>
        </div>

        {rows.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-2xs">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <Receipt className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No transactions yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Once a deal is signed by both parties and a deposit invoice is created, it shows up here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Deal</th>
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-4">Kind</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 sm:px-6">Paid at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={`${r.dealId}-${r.invoiceId}`} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">{r.dealTitle}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{r.invoiceId}</td>
                    <td className="py-3.5 px-4 text-slate-600">{r.kind}</td>
                    <td className="py-3.5 px-4 font-mono font-bold tabular-nums">${r.amount}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.status === "PAID"
                            ? "bg-emerald-600 text-white"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-slate-600 tabular-nums">
                      {r.paidAt ? new Date(r.paidAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
