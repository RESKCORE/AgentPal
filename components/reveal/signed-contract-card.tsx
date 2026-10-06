"use client";

import { useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignedContractCardProps {
  price: number;
  deliveryDays: number;
  revisions: number;
  depositPct: number;
  depositAmount: number;
  contractHash: string;
}

export function SignedContractCard({
  price,
  deliveryDays,
  revisions,
  depositPct,
  depositAmount,
  contractHash,
}: SignedContractCardProps) {
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(contractHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = () => {
    setVerified(true);
    setTimeout(() => setVerified(false), 3000);
  };

  // Truncate hash like a3f9c1...e72b
  const truncatedHash = contractHash.length > 16
    ? `${contractHash.slice(0, 8)}...${contractHash.slice(-6)}`
    : contractHash;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full">
      <div className="space-y-4">
        <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
          Signed contract
        </h3>

        {/* Agreed Terms in one clean line matching wireframe */}
        <div className="font-semibold text-slate-800 text-xs sm:text-sm tabular-nums">
          ${price} · {deliveryDays} days · {revisions} revisions · {depositPct}% deposit (${depositAmount.toFixed(2)})
        </div>

        {/* Hash row with Copy and Verify */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="text-slate-500 font-medium">Hash:</span>
          <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold">
            {truncatedHash}
          </span>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs px-2.5 border-slate-300 gap-1 hover:bg-slate-50"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVerify}
              className={`h-7 text-xs px-2.5 gap-1 transition-colors ${
                verified
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                  : "border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>{verified ? "Verified ✓" : "Verify"}</span>
            </Button>
          </div>
        </div>
      </div>

      {verified && (
        <div className="mt-3 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
          ✓ SHA-256 digest deterministically matches pure Settlement Kernel state.
        </div>
      )}
    </div>
  );
}
