"use client";

import Link from "next/link";
import type { Market } from "@/lib/schema";

interface PredMarketCardProps {
  market: Market;
}

const CATEGORY_COLORS: Record<string, string> = {
  crypto:      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  sports:      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  politics:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  economy:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  geopolitics: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  culture:     "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export default function PredMarketCard({ market }: PredMarketCardProps) {
  const yesProb = Math.round(market.topProbability * 100);
  const noProb = 100 - yesProb;
  const outcomes = (market.outcomes as Array<{ title: string; probability: number }>) ?? [];
  const top3 = [...outcomes]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);
  const primaryCat = market.categories[0] ?? "other";
  const catClass = CATEGORY_COLORS[primaryCat] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  return (
    <Link href={`/market/${market.slug}`} className="group block">
      <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-2">
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${catClass}`}>
            {primaryCat}
          </span>
          {market.onChainMarketId !== null && (
            <span className="ml-auto shrink-0 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
              Live
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 flex-1">
          {market.title}
        </p>

        {/* YES / NO odds row */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
            <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
              {(market.oddsYes / 100).toFixed(2)}×
            </p>
            <p className="text-emerald-500 dark:text-emerald-500 mt-0.5">YES · {yesProb}%</p>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2">
            <p className="text-red-600 dark:text-red-400 font-bold text-base">
              {(market.oddsNo / 100).toFixed(2)}×
            </p>
            <p className="text-red-500 dark:text-red-500 mt-0.5">NO · {noProb}%</p>
          </div>
        </div>

        {/* Top outcomes mini-bars */}
        <div className="space-y-1.5">
          {top3.map((o, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex-1 truncate">{o.title}</div>
              <div
                className="h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500"
                style={{ width: `${Math.max(4, Math.round(o.probability * 100))}%`, maxWidth: "60px" }}
              />
              <span className="w-8 text-right">{Math.round(o.probability * 100)}%</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2">
          <span>Vol {formatVolume(market.volume)}</span>
          <span>24h {formatVolume(market.volume24h)}</span>
        </div>
      </div>
    </Link>
  );
}
