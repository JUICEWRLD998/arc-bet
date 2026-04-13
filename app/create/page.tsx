"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { decodeEventLog } from "viem";
import { Navbar } from "@/components/Navbar";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "@/lib/contracts";

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowedAddress, setAllowedAddress] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Decode marketId from receipt logs
  let createdMarketId: bigint | null = null;
  if (receipt) {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: PREDICTION_MARKET_ABI, ...log });
        if (decoded.eventName === "MarketCreated") {
          createdMarketId = (decoded.args as { marketId: bigint }).marketId;
          break;
        }
      } catch { /* skip */ }
    }
  }

  const shareUrl = createdMarketId != null
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/market/${createdMarketId}`
    : null;

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }
    if (!endDate) {
      setError("Please pick an end time.");
      return;
    }
    const endTime = BigInt(Math.floor(new Date(endDate).getTime() / 1000));
    if (endTime <= BigInt(Math.floor(Date.now() / 1000))) {
      setError("End time must be in the future.");
      return;
    }
    if (isPrivate && !allowedAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
      setError("Please enter a valid allowed address.");
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: "createMarket",
      args: [
        question,
        endTime,
        isPrivate,
        isPrivate ? (allowedAddress as `0x${string}`) : "0x0000000000000000000000000000000000000000",
        "",   // yesLabel — empty for pool-based user markets
        "",   // noLabel
        0n,   // oddsYes — 0 = pool-based mode
        0n,   // oddsNo
      ],
      value: 0n,
    });
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-600 dark:text-emerald-400"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Market Created!
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Your prediction market is now live on Arc Network.
            </p>

            {shareUrl && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-2 text-left">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Share this market</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate">{shareUrl}</p>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center pt-2">
              {createdMarketId != null && (
                <button
                  onClick={() => router.push(`/market/${createdMarketId}`)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
                >
                  View Market
                </button>
              )}
              <button
                onClick={() => router.push("/")}
                className="px-6 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold transition-colors"
              >
                All Markets
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Create a Market
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Ask a yes/no question and let the crowd predict the outcome.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will ETH reach $10,000 before the end of 2025?"
              rows={3}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-colors"
            />
          </div>

          {/* End time */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Betting Closes At
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Private toggle */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Private Market
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Restrict betting to one specific address
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isPrivate ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isPrivate ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Allowed address */}
          {isPrivate && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Allowed Address
              </label>
              <input
                type="text"
                value={allowedAddress}
                onChange={(e) => setAllowedAddress(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-mono text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Submit */}
          {!isConnected ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              Connect your wallet to create a market.
            </div>
          ) : (
            <button
              type="submit"
              disabled={isPending || isConfirming}
              className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Spinner />
                  Confirm in wallet…
                </>
              ) : isConfirming ? (
                <>
                  <Spinner />
                  Confirming transaction…
                </>
              ) : (
                "Create Market"
              )}
            </button>
          )}
        </form>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}
