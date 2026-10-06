"use client";

import { ClipboardList } from "lucide-react";
import { TaskCheckbox } from "@/components/spectrumui/task-checkbox";
import type { DealData } from "@/lib/deal-store";

const SETTLED = ["agreed", "deposit_invoiced", "paid"];

export function DealProgress({ deal }: { deal: DealData }) {
  const steps: { label: string; description: string; done: boolean }[] = [
    {
      label: "Mandates sealed",
      description: "Both sides locked confidential limits",
      done: Boolean(deal.buyerMandate && deal.sellerMandate),
    },
    {
      label: "Negotiation started",
      description: "Agents exchanging structured offers",
      done: deal.events.some((e) => e.type === "offer"),
    },
    {
      label: "Agreement reached",
      description: "Every term inside both mandates",
      done: SETTLED.includes(deal.status),
    },
    {
      label: "Contract signed",
      description: "SHA-256 tamper-evident hash issued",
      done: Boolean(deal.contract),
    },
    {
      label: "Deposit paid",
      description: "PayPal Sandbox invoice settled",
      done: deal.paypalInvoice?.status === "PAID" || deal.status === "paid",
    },
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-1">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <ClipboardList className="h-4 w-4 text-slate-700" />
        <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">Deal progress</h3>
      </div>
      {steps.map((step) => (
        <TaskCheckbox
          key={step.label}
          checked={step.done}
          disabled
          size="sm"
          label={step.label}
          description={step.description}
        />
      ))}
    </div>
  );
}
