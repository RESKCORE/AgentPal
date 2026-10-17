"use client";

import { useState } from "react";
import { ShieldCheck, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { DealEventItem } from "./two-lane-transcript";

interface AuditLogBarProps {
  events: DealEventItem[];
  dealId: string;
}

export function AuditLogBar({ events, dealId }: AuditLogBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate deterministic audit log items
  const auditEntries = events.slice().reverse().flatMap((evt, idx) => {
    const p = evt.payload;
    const baseNum = events.length * 2 - idx * 2;

    if (evt.type === "blocked") {
      return [
        `#${baseNum} kernel: blocked (${p.blocked_reason || "leak guard / out-of-mandate"})`,
        `#${baseNum - 1} ${evt.actor}: attempted offer outside limits`,
      ];
    }

    if (evt.type === "accept") {
      return [
        `#${baseNum} kernel: mutual agreement confirmed, sha-256 seal issued`,
        `#${baseNum - 1} ${evt.actor}: terms accepted`,
      ];
    }

    return [
      `#${baseNum} kernel: offer #${evt.seq} verified inside private mandate`,
      `#${baseNum - 1} ${evt.actor}: offer #${evt.seq} proposed ($${p.price} · ${p.delivery_days}d · ${p.revisions}rev · ${p.deposit_pct}%)`,
    ];
  });

  const fullAuditString = `[Deal: ${dealId}] ` + auditEntries.join(" · ");

  const handleCopy = () => {
    navigator.clipboard.writeText(fullAuditString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden text-xs">
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="font-extrabold text-slate-800 tracking-tight">
            Audit log (append-only)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
            {auditEntries.length} entries
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors px-2 py-0.5 rounded border border-slate-200 bg-white"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </div>

      <div className="p-3 bg-zinc-100 text-zinc-700 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-nowrap">
        {auditEntries.length === 0 ? (
          <span className="text-slate-500 italic">No events recorded in audit log yet.</span>
        ) : expanded ? (
          <div className="space-y-1 whitespace-normal">
            {auditEntries.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold select-none">&gt;</span>
                <span className={line.includes("blocked") ? "text-rose-600" : "text-zinc-700"}>
                  {line}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="truncate">
            {fullAuditString}
          </div>
        )}
      </div>
    </div>
  );
}
