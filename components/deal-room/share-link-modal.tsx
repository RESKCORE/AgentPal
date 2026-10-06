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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Magic Deal Link ready</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send this to your counterparty. It opens their mandate setup — yours stays sealed.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 truncate"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0 h-9 px-3 text-xs font-semibold gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <Button
              type="button"
              onClick={onEnterRoom}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 rounded-xl gap-1.5"
            >
              <span>Enter Deal Room now</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
