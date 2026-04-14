"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "@/lib/contracts";

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function BetRow({ marketId, address }: { marketId: number; address: `0x${string}` }) {
  const { data: marketData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarket",
    args: [BigInt(marketId)],
  });

  const { data: betData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getUserBet",
    args: [BigInt(marketId), address],
  });

  const { data: claimed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "claimed",
    args: [BigInt(marketId), address],
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (!marketData || !betData) return null;

  const betAmount = betData[0];
  const betSide = betData[1];

  // No bet placed on this market
  if (betAmount === 0n) return null;

  const [question, creator, endTime, resolved, outcome] = marketData;
  const hasEnded = Math.floor(Date.now() / 1000) >= Number(endTime);
  const won = resolved && betSide === outcome;
  const lost = resolved && betSide !== outcome;
  const isCreator = address?.toLowerCase() === (creator as string)?.toLowerCase();

  let statusLabel = "Active";
  let statusClass =
    "bg-indigo-90 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400";

  if (resolved) {
    if (won) {
      statusLabel = claimed || isSuccess ? "Claimed" : "Won";
      statusClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
    } else {
      statusLabel = "Lost";
      statusClass = "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400";
    }
  } else if (hasEnded) {
    statusLabel = "Pending";
    statusClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  }

  const isBusy = isPending || isConfirming;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1 flex-1">
        <Link
          href={`/market/${marketId}`}
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 transition-colors"
        >
          {question}
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass}`}
          >
            {statusLabel}
          </span>
          <span
            className={`text-xs font-semibold ${
              betSide
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {betSide ? "YES" : "NO"}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {Number(formatUnits(betAmount, 18)).toFixed(2)} USDC
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Resolve prompt for creators whose market ended but isn't resolved */}
        {isCreator && hasEnded && !resolved && (
          <Link
            href={`/market/${marketId}`}
            className="px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors whitespace-nowrap"
          >
            Resolve now →
          </Link>
        )}

        {/* Claim action — always visible, state-dependent */}
        {claimed || isSuccess ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold px-3 py-2">✓ Claimed</span>
        ) : resolved && lost ? (
          <span className="text-xs text-rose-500 dark:text-rose-400 font-semibold px-3 py-2">Lost</span>
        ) : resolved && won ? (
          <button
            onClick={() =>
              writeContract({
                address: CONTRACT_ADDRESS,
                abi: PREDICTION_MARKET_ABI,
                functionName: "claimWinnings",
                args: [BigInt(marketId)],
              })
            }
            disabled={isBusy}
            className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            {isBusy ? <><Spinner /> Claiming…</> : "Claim Winnings"}
          </button>
        ) : (
          <button
            disabled
            title={hasEnded ? "Awaiting creator resolution" : "Betting still open"}
            className="shrink-0 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-sm font-semibold cursor-not-allowed flex items-center gap-2"
          >
            Claim
          </button>
        )}
      </div>
    </div>
  );
}

function BetList({ count, address }: { count: number; address: `0x${string}` }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <BetRow key={i} marketId={i} address={address} />
      ))}
    </div>
  );
}

export default function MyBetsPage() {
  const { address, isConnected } = useAccount();

  const { data: marketCount, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "marketCount",
  });

  const count = marketCount ? Number(marketCount) : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">My Bets</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Your prediction positions across all markets.
          </p>
        </div>

        {!isConnected ? (
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
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                Wallet not connected
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Connect your wallet to view your bets.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-zinc-500 dark:text-zinc-400">No markets exist yet.</p>
            <Link
              href="/"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Browse markets
            </Link>
          </div>
        ) : (
          <BetList count={count} address={address!} />
        )}
      </main>
    </div>
  );
}
