"use client";

import Link from "next/link";
import { formatUnits } from "viem";

export interface MarketCardProps {
  id: number;
  question: string;
  totalYesPool: bigint;
  totalNoPool: bigint;
  endTime: bigint;
  resolved: boolean;
  outcome: boolean;
}

function useCountdown(endTime: bigint) {
  const end = Number(endTime) * 1000;
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return "Ended";

  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);

  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function MarketCard({
  id,
  question,
  totalYesPool,
  totalNoPool,
  endTime,
  resolved,
  outcome,
}: MarketCardProps) {
  const totalPool = totalYesPool + totalNoPool;
  const yesPercent =
    totalPool > 0n ? Number((totalYesPool * 100n) / totalPool) : 50;
  const noPercent = 100 - yesPercent;
  const countdown = useCountdown(endTime);
  const formattedPool = Number(formatUnits(totalPool, 6)).toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );

  return (
    <Link href={`/market/${id}`}>
      <div className="group relative flex flex-col gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-100 dark:hover:shadow-indigo-950 transition-all duration-200 cursor-pointer h-full">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          {resolved ? (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                outcome
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Resolved: {outcome ? "YES" : "NO"}
            </span>
          ) : countdown === "Ended" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Awaiting Resolution
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Live
            </span>
          )}

          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {countdown}
          </span>
        </div>

        {/* Question */}
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50 leading-snug line-clamp-3 flex-1">
          {question}
        </p>

        {/* Pool info */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>YES {yesPercent}%</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {formattedPool} USDC
            </span>
            <span>NO {noPercent}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
