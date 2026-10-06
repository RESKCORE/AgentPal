"use client";

import { useMemo, useCallback } from "react";

interface OfferEvent {
  id: string;
  seq: number;
  actor: string;
  type: string;
  payload: {
    price?: number;
    delivery_days?: number;
    revisions?: number;
    deposit_pct?: number;
    message?: string;
  };
  timestamp: string;
}

interface ConvergenceChartProps {
  events: OfferEvent[];
  buyerName?: string;
  sellerName?: string;
}

export function ConvergenceChart({
  events,
  buyerName = "Buyer",
  sellerName = "Seller",
}: ConvergenceChartProps) {
  // Extract offers with prices
  const validOffers = useMemo(() => {
    return events
      .filter((e) => (e.type === "offer" || e.type === "accept") && typeof e.payload?.price === "number")
      .map((e) => ({
        seq: e.seq,
        actor: e.actor,
        price: e.payload.price as number,
        isBuyer: e.actor.includes("buyer"),
      }));
  }, [events]);

  // Chart coordinates
  const width = 500;
  const height = 180;
  const padding = { top: 30, right: 35, bottom: 35, left: 55 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Find min and max price across offers (with fallbacks)
  const prices = validOffers.map((o) => o.price);
  const minPrice = prices.length ? Math.min(...prices, 250) : 250;
  const maxPrice = prices.length ? Math.max(...prices, 350) : 350;
  const priceRange = Math.max(maxPrice - minPrice, 20);

  // Group buyer and seller points
  const buyerPoints = validOffers.filter((o) => o.isBuyer);
  const sellerPoints = validOffers.filter((o) => !o.isBuyer);

  const maxRounds = Math.max(validOffers.length, 3);

  const getX = useCallback((index: number) => {
    if (maxRounds <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (maxRounds - 1)) * innerWidth;
  }, [maxRounds, innerWidth, padding.left]);

  const getY = useCallback((price: number) => {
    return padding.top + innerHeight - ((price - minPrice) / priceRange) * innerHeight;
  }, [minPrice, priceRange, innerHeight, padding.top]);

  // Generate SVG path for seller line
  const sellerPath = useMemo(() => {
    if (sellerPoints.length === 0) return "";
    return sellerPoints
      .map((p) => {
        const globalIdx = validOffers.findIndex((o) => o.seq === p.seq);
        const x = getX(globalIdx >= 0 ? globalIdx : 0);
        const y = getY(p.price);
        return `${x},${y}`;
      })
      .join(" L ");
  }, [sellerPoints, validOffers, getX, getY]);

  // Generate SVG path for buyer line
  const buyerPath = useMemo(() => {
    if (buyerPoints.length === 0) return "";
    return buyerPoints
      .map((p) => {
        const globalIdx = validOffers.findIndex((o) => o.seq === p.seq);
        const x = getX(globalIdx >= 0 ? globalIdx : 0);
        const y = getY(p.price);
        return `${x},${y}`;
      })
      .join(" L ");
  }, [buyerPoints, validOffers, getX, getY]);

  const latestSellerPrice = sellerPoints.length ? sellerPoints[sellerPoints.length - 1].price : null;
  const latestBuyerPrice = buyerPoints.length ? buyerPoints[buyerPoints.length - 1].price : null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full relative">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-900 text-sm tracking-tight">
            Convergence (price per round)
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
            <span>Seller ({sellerName})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-800 inline-block" />
            <span>Buyer ({buyerName})</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full flex-1 flex items-center justify-center min-h-[160px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full max-h-[180px] overflow-visible"
        >
          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerHeight / 2}
            x2={width - padding.right}
            y2={padding.top + innerHeight / 2}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* Y Axis line */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* Y Axis labels */}
          <text
            x={padding.left - 8}
            y={padding.top + 4}
            textAnchor="end"
            className="text-[11px] fill-slate-400 font-mono font-medium"
          >
            ${maxPrice}
          </text>
          <text
            x={padding.left - 8}
            y={padding.top + innerHeight / 2 + 4}
            textAnchor="end"
            className="text-[11px] fill-slate-400 font-mono font-medium"
          >
            ${Math.round((maxPrice + minPrice) / 2)}
          </text>
          <text
            x={padding.left - 8}
            y={height - padding.bottom + 4}
            textAnchor="end"
            className="text-[11px] fill-slate-400 font-mono font-medium"
          >
            ${minPrice}
          </text>

          {/* Zero offers empty state */}
          {validOffers.length === 0 && (
            <text
              x={padding.left + innerWidth / 2}
              y={padding.top + innerHeight / 2 + 4}
              textAnchor="middle"
              className="text-xs fill-slate-400 italic font-medium"
            >
              Waiting for initial offer to begin plotting convergence...
            </text>
          )}

          {/* Seller Line (Emerald) */}
          {sellerPath && (
            <path
              d={`M ${sellerPath}`}
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Buyer Line (Slate Dashed) */}
          {buyerPath && (
            <path
              d={`M ${buyerPath}`}
              fill="none"
              stroke="#1e293b"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Seller Data Points & Labels */}
          {sellerPoints.map((p) => {
            const globalIdx = validOffers.findIndex((o) => o.seq === p.seq);
            const x = getX(globalIdx >= 0 ? globalIdx : 0);
            const y = getY(p.price);
            return (
              <g key={`seller-pt-${p.seq}`}>
                <circle cx={x} cy={y} r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  className="text-[11px] font-extrabold fill-emerald-800 font-mono"
                >
                  ${p.price}
                </text>
              </g>
            );
          })}

          {/* Buyer Data Points & Labels */}
          {buyerPoints.map((p) => {
            const globalIdx = validOffers.findIndex((o) => o.seq === p.seq);
            const x = getX(globalIdx >= 0 ? globalIdx : 0);
            const y = getY(p.price);
            return (
              <g key={`buyer-pt-${p.seq}`}>
                <circle cx={x} cy={y} r="5" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
                <text
                  x={x}
                  y={y + 18}
                  textAnchor="middle"
                  className="text-[11px] font-extrabold fill-slate-800 font-mono"
                >
                  ${p.price}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Convergence Summary Footer */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          {latestSellerPrice !== null && latestBuyerPrice !== null ? (
            <>
              <span>Seller: <strong className="text-emerald-700 font-bold tabular-nums">${latestSellerPrice}</strong></span>
              <span>·</span>
              <span>Buyer: <strong className="text-slate-900 font-bold tabular-nums">${latestBuyerPrice}</strong></span>
              <span>·</span>
              <span>Spread: <strong className="tabular-nums font-semibold">${Math.abs(latestSellerPrice - latestBuyerPrice)}</strong></span>
            </>
          ) : latestSellerPrice !== null ? (
            <>
              <span>Seller opening offer: <strong className="text-emerald-700 font-bold tabular-nums">${latestSellerPrice}</strong></span>
              <span>·</span>
              <span className="italic">Waiting for buyer counter-offer</span>
            </>
          ) : (
            <span className="italic">Round 1 initial state · Ready to negotiate</span>
          )}
        </div>
        <div className="hidden sm:inline-block bg-amber-50 text-amber-900 px-2 py-0.5 rounded text-[10px] font-medium border border-amber-200">
          Offer cards show change chips (movement)
        </div>
      </div>
    </div>
  );
}
