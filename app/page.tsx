"use client";

import { useReadContract } from "wagmi";
import { Navbar } from "@/components/Navbar";
import { MarketCard } from "@/components/MarketCard";
import { FaucetBanner } from "@/components/FaucetBanner";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "@/lib/contracts";
import Link from "next/link";

function useMarket(id: number) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarket",
    args: [BigInt(id)],
  });
}

function MarketList({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <MarketItem key={i} id={i} />
      ))}
    </div>
  );
}

function MarketItem({ id }: { id: number }) {
  const { data, isLoading } = useMarket(id);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 h-48 animate-pulse">
        <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700 mb-4" />
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    );
  }

  if (!data) return null;

  const [question, , endTime, resolved, outcome, totalYesPool, totalNoPool] =
    data;

  return (
    <MarketCard
      id={id}
      question={question}
      totalYesPool={totalYesPool}
      totalNoPool={totalNoPool}
      endTime={endTime}
      resolved={resolved}
      outcome={outcome}
    />
  );
}

export default function Home() {
  const { data: marketCount, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "marketCount",
  });

  const count = marketCount ? Number(marketCount) : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Faucet Banner */}
        <FaucetBanner />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Prediction Markets
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Bet on real-world outcomes using USDC on Arc Network
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create Market
          </Link>
        </div>

        {/* Markets */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 h-48 animate-pulse"
              >
                <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700 mb-4" />
                <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-400"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                No markets yet
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Be the first to create a prediction market.
              </p>
            </div>
            <Link
              href="/create"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              Create the first market
            </Link>
          </div>
        ) : (
          <MarketList count={count} />
        )}
      </main>
    </div>
  );
}

