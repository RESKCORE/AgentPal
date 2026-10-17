"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareLinkModalProps {
  open: boolean;
  url: string;
  onEnterRoom: () => void;
}

export function ShareLinkModal({ open, url, onEnterRoom }: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — user can select the text manually
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl border border-zinc-200 shadow-[0_10px_30px_rgba(0,0,0,0.12)] max-w-md w-full p-6 space-y-5 text-zinc-900"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-zinc-900 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-zinc-900 text-sm font-outfit">Magic Deal Link ready</h3>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Send this to your counterparty. It opens their mandate setup — yours stays sealed.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-800 truncate focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 h-9 px-3 text-xs font-semibold gap-1.5 rounded-lg bg-zinc-200 hover:bg-white/15 text-zinc-900 border border-zinc-300 inline-flex items-center transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onEnterRoom}
              className="w-full glossy-btn-blue text-white text-xs font-bold h-10 rounded-xl inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <span>Enter Deal Room now</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
