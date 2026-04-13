"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import type { OnchainMarket } from "@/app/api/markets/onchain/route";

export default function OnchainMarketCard({ market }: { market: OnchainMarket }) {
  const now = Math.floor(Date.now() / 1000);
  const hasEnded = now >= market.endTime;

  const totalYes = BigInt(market.totalYesPool);
  const totalNo = BigInt(market.totalNoPool);
  const totalPool = totalYes + totalNo;
  const yesPercent = totalPool > 0n ? Number((totalYes * 100n) / totalPool) : 50;

  const formattedTotal = Number(formatUnits(totalPool, 6)).toFixed(2);

  const statusLabel = market.resolved
    ? market.outcome
      ? "Resolved: YES"
      : "Resolved: NO"
    : hasEnded
    ? "Awaiting Resolution"
    : "Live";

  const statusClass = market.resolved
    ? market.outcome
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
    : hasEnded
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400";

  return (
    <Link href={`/market/${market.id}`} className="group block">
      <div className="h-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            custom
          </span>
          <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        {/* Question */}
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 line-clamp-3 flex-1">
          {market.question}
        </p>

        {/* Pool bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">YES {yesPercent}%</span>
            <span className="text-rose-600 dark:text-rose-400">NO {100 - yesPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-rose-100 dark:bg-rose-900/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Pool: {formattedTotal} USDC</span>
          <span>#{market.id}</span>
        </div>
      </div>
    </Link>
  );
}
