"use client";

import { motion } from "framer-motion";

interface ZOPAHeroAxisProps {
  buyerName?: string;
  sellerName?: string;
  buyerMin?: number;
  buyerMax?: number;
  sellerMin?: number;
  sellerMax?: number;
  agreedPrice: number;
}

export function ZOPAHeroAxis({
  buyerName = "Buyer",
  sellerName = "Seller",
  buyerMin = 200,
  buyerMax = 350,
  sellerMin = 250,
  sellerMax = 400,
  agreedPrice = 295,
}: ZOPAHeroAxisProps) {
  // Global range for the axis
  const minScale = Math.min(buyerMin, sellerMin, 180);
  const maxScale = Math.max(buyerMax, sellerMax, 420);
  const totalRange = Math.max(maxScale - minScale, 1);

  const getPercent = (val: number) => {
    const clamped = Math.max(minScale, Math.min(maxScale, val));
    return ((clamped - minScale) / totalRange) * 100;
  };

  const sellerMinPct = getPercent(sellerMin);
  const buyerMaxPct = getPercent(buyerMax);
  const agreedPct = getPercent(agreedPrice);

  // ZOPA bounds
  const zopaLeft = Math.min(sellerMinPct, buyerMaxPct);
  const zopaWidth = Math.max(Math.abs(buyerMaxPct - sellerMinPct), 4);

  // Calculations for subtext
  const buyerSavings = Math.max(buyerMax - agreedPrice, 0);
  const buyerSavingsPct = buyerMax > 0 ? Math.round((buyerSavings / buyerMax) * 100) : 0;
  const sellerSurplus = Math.max(agreedPrice - sellerMin, 0);

  return (
    <motion.div
      initial={{ filter: "blur(8px)", opacity: 0 }}
      animate={{ filter: "blur(0px)", opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
    >
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-slate-900 text-sm tracking-tight">
          Zone of Possible Agreement (price)
        </span>
        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
          ZOPA Overlap
        </span>
      </div>

      {/* Axis Canvas */}
      <div className="relative pt-12 pb-14 px-4 sm:px-8">
        {/* Baseline Axis Track */}
        <div className="relative h-1 bg-slate-900 rounded-full">
          {/* Overlapping Emerald ZOPA Band */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-6 bg-emerald-500/25 border-y-2 border-emerald-600 rounded-xs"
            style={{
              left: `${zopaLeft}%`,
              width: `${zopaWidth}%`,
            }}
          />

          {/* Left Tick: Seller min */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${sellerMinPct}%` }}
          >
            {/* Vertical tick mark */}
            <div className="h-8 w-0.5 bg-slate-900" />
            <div className="absolute top-6 whitespace-nowrap text-center -translate-x-1/2">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight block">
                Seller min ${sellerMin}
              </span>
            </div>
          </div>

          {/* Right Tick: Buyer max */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${buyerMaxPct}%` }}
          >
            {/* Vertical tick mark */}
            <div className="h-8 w-0.5 bg-slate-900" />
            <div className="absolute top-6 whitespace-nowrap text-center -translate-x-1/2">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight block">
                Buyer max ${buyerMax}
              </span>
            </div>
          </div>

          {/* Final Settlement Dot on Axis */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-20 pointer-events-none"
            style={{ left: `${agreedPct}%` }}
          >
            {/* Upper Label */}
            <div className="absolute bottom-6 whitespace-nowrap text-center -translate-x-1/2">
              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight block">
                Final ${agreedPrice}
              </span>
            </div>
            {/* Centered emerald dot */}
            <div className="h-4 w-4 rounded-full bg-emerald-600 border-2 border-white shadow-sm ring-2 ring-emerald-500/40" />
          </div>
        </div>
      </div>

      {/* Subtext under axis matching wireframe sketch */}
      <div className="pt-2 border-t border-slate-100 text-center text-xs sm:text-sm text-slate-600 font-medium">
        <span>
          {buyerName} saved <strong className="text-slate-900 font-bold tabular-nums">${buyerSavings}</strong>{" "}
          ({buyerSavingsPct}% under her max). {sellerName} earned{" "}
          <strong className="text-slate-900 font-bold tabular-nums">${sellerSurplus}</strong> above his floor.
        </span>
      </div>
    </motion.div>
  );
}
