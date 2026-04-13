"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import type { Market } from "@/lib/schema";
import OnchainMarketPage from "./OnchainMarketPage";

interface Outcome {
  title: string;
  probability: number;
  day_change: number;
}

interface Props {
  market: Market & { syncedAt: string }; // syncedAt serialized as ISO string
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export default function PredMarketPage({ market }: Props) {
  const { isConnected } = useAccount();
  const [onChainId, setOnChainId] = useState<bigint | null>(
    market.onChainMarketId !== null ? BigInt(market.onChainMarketId) : null
  );
  const [isActivating, setIsActivating] = useState(false);
  const [activateError, setActivateError] = useState("");

  // Once activated, delegate to the standard on-chain market page
  if (onChainId !== null) {
    return <OnchainMarketPage marketId={onChainId} />;
  }

  const outcomes = (market.outcomes as Outcome[] | null) ?? [];
  const sorted = [...outcomes].sort((a, b) => b.probability - a.probability);
  const yesProb = Math.round(market.topProbability * 100);
  const noProb = 100 - yesProb;

  async function handleActivate() {
    setActivateError("");
    setIsActivating(true);
    try {
      const res = await fetch("/api/markets/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: market.slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Activation failed");
      setOnChainId(BigInt(data.marketId));
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      {/* We import Navbar lazily to avoid circular dep — just inline a back link instead */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur px-4 py-3 flex items-center gap-3">
        <a href="/" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← Markets
        </a>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium line-clamp-1">{market.title}</span>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 space-y-8">
        {/* Title + categories */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {market.categories.map((cat) => (
              <span key={cat} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 capitalize">
                {cat}
              </span>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
            {market.title}
          </h1>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span>Vol ${(market.volume / 1000).toFixed(1)}K</span>
            <span>24h ${(market.volume24h / 1000).toFixed(1)}K</span>
            <a href={market.predScopeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors flex items-center gap-1">
              PredScope <ArrowIcon />
            </a>
          </div>
        </div>

        {/* YES / NO cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5 space-y-2">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">YES</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-300">{(market.oddsYes / 100).toFixed(2)}×</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">{market.yesLabel}</p>
            <p className="text-xs text-zinc-400">{yesProb}% chance</p>
          </div>
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-5 space-y-2">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">NO</p>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-300">{(market.oddsNo / 100).toFixed(2)}×</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">{market.noLabel}</p>
            <p className="text-xs text-zinc-400">{noProb}% chance</p>
          </div>
        </div>

        {/* All outcomes table */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">All Outcomes</h2>
          <div className="space-y-2">
            {sorted.map((o, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-full">
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    <span className="truncate pr-2">{o.title}</span>
                    <span className="shrink-0 font-semibold">{Math.round(o.probability * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.max(1, Math.round(o.probability * 100))}%` }}
                    />
                  </div>
                </div>
                {o.day_change !== 0 && (
                  <span className={`shrink-0 text-xs font-medium ${o.day_change > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {o.day_change > 0 ? "+" : ""}{(o.day_change * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Activate to bet */}
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Bet on this market</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              This market needs to be activated on-chain before you can place bets. The operator will seed initial liquidity automatically.
            </p>
          </div>

          {activateError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{activateError}</p>
          )}

          {!isConnected ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">Connect your wallet to activate and bet.</p>
          ) : (
            <button
              onClick={handleActivate}
              disabled={isActivating}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isActivating ? <><Spinner /> Activating…</> : "Activate & Bet"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
