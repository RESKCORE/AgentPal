"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";

interface MandatePriceRange {
  priceMin?: number;
  price_min?: number;
  priceMax?: number;
  price_max?: number;
}

interface ZOPAChartProps {
  buyerMandate: MandatePriceRange;
  sellerMandate: MandatePriceRange;
  agreedPrice: number;
}

export function ZOPAChart({
  buyerMandate,
  sellerMandate,
  agreedPrice,
}: ZOPAChartProps) {
  const bPriceMin = buyerMandate.priceMin ?? buyerMandate.price_min ?? 0;
  const bPriceMax = buyerMandate.priceMax ?? buyerMandate.price_max ?? 0;
  const sPriceMin = sellerMandate.priceMin ?? sellerMandate.price_min ?? 0;
  const sPriceMax = sellerMandate.priceMax ?? sellerMandate.price_max ?? 0;

  // Calculate ZOPA
  const zopaMin = Math.max(sPriceMin, bPriceMin);
  const zopaMax = Math.min(bPriceMax, sPriceMax);
  const hasOverlap = zopaMax >= zopaMin;

  // Global scale range
  const minPrice = Math.min(bPriceMin, sPriceMin);
  const maxPrice = Math.max(bPriceMax, sPriceMax);
  const range = Math.max(maxPrice - minPrice, 1);

  // Position percentage mapper
  const getPosition = (value: number) => {
    const clamped = Math.max(minPrice, Math.min(maxPrice, value));
    return ((clamped - minPrice) / range) * 100;
  };

  const buyerMinPos = getPosition(bPriceMin);
  const buyerMaxPos = getPosition(bPriceMax);
  const sellerMinPos = getPosition(sPriceMin);
  const sellerMaxPos = getPosition(sPriceMax);
  const agreedPricePos = getPosition(agreedPrice);
  const zopaMinPos = getPosition(zopaMin);
  const zopaMaxPos = getPosition(zopaMax);

  // Surplus calculation
  const totalSurplus = Math.max(bPriceMax - sPriceMin, 1);
  const sellerCaptured = Math.max(agreedPrice - sPriceMin, 0);
  const buyerCaptured = Math.max(bPriceMax - agreedPrice, 0);
  const sellerPct = Math.min(100, Math.max(0, Math.round((sellerCaptured / totalSurplus) * 100)));
  const buyerPct = Math.min(100, Math.max(0, Math.round((buyerCaptured / totalSurplus) * 100)));

  return (
    <div className="space-y-6">
      {/* ZOPA Visualization Canvas */}
      <Card className="border-slate-200/90 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Zone of Possible Agreement (ZOPA)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Both private limits revealed: Buyer&apos;s ceiling vs Seller&apos;s floor
                </CardDescription>
              </div>
            </div>

            {hasOverlap ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold gap-1 text-xs py-1 px-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>ZOPA Overlap: {formatCurrency(zopaMin)} – {formatCurrency(zopaMax)}</span>
              </Badge>
            ) : (
              <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-xs py-1 px-3">
                No ZOPA Overlap
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-8">
          {/* Main Visual Range Track */}
          <div className="relative pt-8 pb-12">
            {/* Price Scale Indicators */}
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-4 px-1">
              <span>Min Scale: {formatCurrency(minPrice)}</span>
              <span>Max Scale: {formatCurrency(maxPrice)}</span>
            </div>

            {/* Scale Line Track */}
            <div className="relative h-2 bg-slate-100 rounded-full mb-8">
              {/* ZOPA Range Highlight */}
              {hasOverlap && (
                <div
                  className="absolute top-0 bottom-0 bg-emerald-400/40 rounded-full"
                  style={{
                    left: `${zopaMinPos}%`,
                    width: `${Math.max(zopaMaxPos - zopaMinPos, 2)}%`,
                  }}
                />
              )}
            </div>

            {/* Buyer Range Row */}
            <div className="relative h-12 mb-5">
              <div
                className="absolute inset-y-0 rounded-xl bg-gradient-to-r from-blue-500/15 via-blue-500/20 to-blue-500/30 border border-blue-300 flex items-center justify-between px-3.5 shadow-2xs"
                style={{
                  left: `${buyerMinPos}%`,
                  width: `${Math.max(buyerMaxPos - buyerMinPos, 5)}%`,
                }}
              >
                <span className="text-[11px] font-bold text-blue-900 tracking-tight">
                  Buyer: {formatCurrency(bPriceMin)}
                </span>
                <span className="text-[11px] font-extrabold text-blue-900 bg-white/90 px-1.5 py-0.5 rounded shadow-2xs border border-blue-200">
                  Max: {formatCurrency(bPriceMax)}
                </span>
              </div>
            </div>

            {/* Seller Range Row */}
            <div className="relative h-12 mb-4">
              <div
                className="absolute inset-y-0 rounded-xl bg-gradient-to-r from-purple-500/15 via-purple-500/20 to-purple-500/30 border border-purple-300 flex items-center justify-between px-3.5 shadow-2xs"
                style={{
                  left: `${sellerMinPos}%`,
                  width: `${Math.max(sellerMaxPos - sellerMinPos, 5)}%`,
                }}
              >
                <span className="text-[11px] font-extrabold text-purple-900 bg-white/90 px-1.5 py-0.5 rounded shadow-2xs border border-purple-200">
                  Min: {formatCurrency(sPriceMin)}
                </span>
                <span className="text-[11px] font-bold text-purple-900 tracking-tight">
                  Seller: {formatCurrency(sPriceMax)}
                </span>
              </div>
            </div>

            {/* Agreed Final Price Vertical Needle */}
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute top-6 bottom-4 w-0.5 bg-emerald-600 z-20 pointer-events-none"
              style={{ left: `${agreedPricePos}%` }}
            >
              {/* Needle Tag */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="inline-flex items-center gap-1 bg-emerald-600 text-zinc-900 font-black text-xs px-2.5 py-1 rounded-full shadow-md">
                  <Sparkles className="h-3 w-3" />
                  Agreed: {formatCurrency(agreedPrice)}
                </span>
              </div>
              {/* Bottom Dot */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-emerald-600 border-2 border-white shadow-sm" />
            </motion.div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-blue-500/30 border border-blue-400" />
              <span className="font-semibold text-slate-700">Buyer&apos;s Budget (Buyer: ${bPriceMin} – ${bPriceMax})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-purple-500/30 border border-purple-400" />
              <span className="font-semibold text-slate-700">Seller&apos;s Limits (Seller: ${sPriceMin} – ${sPriceMax})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600" />
              <span className="font-bold text-emerald-800">Final Settlement ({formatCurrency(agreedPrice)})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Surplus Split Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Buyer Surplus Card */}
        <Card className="border-slate-200/90 bg-white hover:border-blue-300 transition-colors shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buyer (Buyer Surplus)</p>
                  <p className="text-2xl font-black text-slate-900">{formatCurrency(buyerCaptured)}</p>
                </div>
              </div>
              <Badge className="bg-blue-50 text-blue-800 border-blue-200 font-bold">
                {buyerPct}% of Gap
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${buyerPct}%` }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="h-full bg-blue-500 rounded-full"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Buyer saved <strong className="text-slate-800">{formatCurrency(buyerCaptured)}</strong> below her ceiling of ${bPriceMax}.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Seller Surplus Card */}
        <Card className="border-slate-200/90 bg-white hover:border-purple-300 transition-colors shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seller (Seller Surplus)</p>
                  <p className="text-2xl font-black text-slate-900">{formatCurrency(sellerCaptured)}</p>
                </div>
              </div>
              <Badge className="bg-purple-50 text-purple-800 border-purple-200 font-bold">
                {sellerPct}% of Gap
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${sellerPct}%` }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="h-full bg-purple-500 rounded-full"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Seller earned <strong className="text-slate-800">{formatCurrency(sellerCaptured)}</strong> above his floor of ${sPriceMin}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Surplus Summary Banner */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/40 p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 text-zinc-900 flex items-center justify-center shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Economic Surplus Created</p>
            <p className="text-xl font-black text-emerald-700">{formatCurrency(totalSurplus)}</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 max-w-sm text-right sm:text-left">
          Split <strong className="text-blue-700">{buyerPct}% Buyer</strong> / <strong className="text-purple-700">{sellerPct}% Seller</strong>. Both parties achieved an agreed deal within their mandate constraints.
        </p>
      </div>
    </div>
  );
}
