"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { FaucetBanner } from "@/components/FaucetBanner";
import PredMarketCard from "@/components/PredMarketCard";
import type { Market } from "@/lib/schema";
import Link from "next/link";

const CATEGORIES = ["all", "crypto", "sports", "politics", "economy", "geopolitics", "culture"] as const;
type Category = (typeof CATEGORIES)[number];

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 h-56 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700 mb-4" />
      <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
      <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

export default function Home() {
  const [category, setCategory] = useState<Category>("all");
  const [page, setPage] = useState(1);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMarkets = useCallback(async (cat: Category, pg: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/markets/sync?category=${cat}&page=${pg}`);
      if (!res.ok) throw new Error("Failed to load markets");
      const data = await res.json();
      setMarkets(data.markets ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets(category, page);
  }, [category, page, fetchMarkets]);

  function handleCategory(cat: Category) {
    setCategory(cat);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <FaucetBanner />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Prediction Markets</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Bet on real-world outcomes using USDC on Arc Network
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create Market
          </Link>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                category === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        {error ? (
          <div className="text-center py-16 text-rose-500">{error}</div>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">No markets found</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Try a different category or check back soon.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {markets.map((m) => (
              <PredMarketCard key={m.slug} market={m} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

