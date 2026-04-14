"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { Navbar } from "@/components/Navbar";
import type { LeaderboardEntry, LeaderboardResponse } from "@/app/api/leaderboard/route";

// ─── helpers ────────────────────────────────────────────────────────────────

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUSDC(raw: string): string {
  try {
    const n = Number(formatUnits(BigInt(raw), 18));
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return "0.00";
  }
}

// ─── medal badge ────────────────────────────────────────────────────────────

const MEDALS: Record<number, { label: string; classes: string }> = {
  0: {
    label: "🥇",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-700",
  },
  1: {
    label: "🥈",
    classes:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 ring-1 ring-zinc-300 dark:ring-zinc-600",
  },
  2: {
    label: "🥉",
    classes:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 ring-1 ring-orange-300 dark:ring-orange-700",
  },
};

function RankBadge({ rank }: { rank: number }) {
  const medal = MEDALS[rank];
  if (medal) {
    return (
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base font-bold ${medal.classes}`}
      >
        {medal.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800">
      {rank + 1}
    </span>
  );
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800 animate-pulse">
      <td className="py-4 px-4">
        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="py-4 px-4">
        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="py-4 px-4 hidden sm:table-cell">
        <div className="h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="py-4 px-4 hidden md:table-cell">
        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="py-4 px-4">
        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
    </tr>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        const data: LeaderboardResponse = await res.json();
        setEntries(data.entries);
        setUpdatedAt(data.updatedAt);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Leaderboard</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Top predictors ranked by total USDC wagered on ArcBet.
            </p>
          </div>
          {updatedAt && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
              Updated {new Date(updatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-400 mb-6">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-12">
                  #
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Address
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hidden sm:table-cell">
                  Bets
                </th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                  Biggest Bet (USDC)
                </th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Total Wagered (USDC)
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                : entries.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                      No bets recorded yet. Be the first to predict!
                    </td>
                  </tr>
                )
                : entries.map((entry, i) => (
                  <tr
                    key={entry.address}
                    className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                      i === 0 ? "bg-amber-50/40 dark:bg-amber-900/10" : ""
                    }`}
                  >
                    <td className="py-4 px-4">
                      <RankBadge rank={i} />
                    </td>
                    <td className="py-4 px-4">
                      <a
                        href={`https://testnet.arcscan.app/address/${entry.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title={entry.address}
                      >
                        {shortAddress(entry.address)}
                      </a>
                    </td>
                    <td className="py-4 px-4 hidden sm:table-cell">
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium tabular-nums">
                        {entry.betsCount}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right hidden md:table-cell">
                      <span className="text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {formatUSDC(entry.largestBet)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                        {formatUSDC(entry.totalWagered)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && entries.length > 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4 text-center">
            Showing top {entries.length} traders · Ranked by total USDC wagered
          </p>
        )}
      </main>
    </div>
  );
}


