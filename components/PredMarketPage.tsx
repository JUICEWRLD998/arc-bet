"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, parseAbi, decodeEventLog } from "viem";
import { CONTRACT_ADDRESS } from "@/lib/contracts";
import { Navbar } from "@/components/Navbar";
import type { Market } from "@/lib/schema";

const MARKET_ABI = parseAbi([
  "function createMarket(string question, uint256 endTime, bool isPrivate, address allowedAddress, string yesLabel, string noLabel, uint256 oddsYes, uint256 oddsNo) payable returns (uint256 marketId)",
  "function placeBet(uint256 marketId, bool isYes) payable",
  "event MarketCreated(uint256 indexed marketId, address indexed creator, string question, uint256 endTime, bool isPrivate, address allowedAddress)",
]);

interface Outcome {
  title: string;
  probability: number;
  day_change?: number;
}

interface Props {
  market: Market & { syncedAt: string };
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function PercentBar({ yesPercent }: { yesPercent: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span className="text-emerald-600 dark:text-emerald-400">YES {yesPercent}%</span>
        <span className="text-rose-600 dark:text-rose-400">NO {100 - yesPercent}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-rose-100 dark:bg-rose-900/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${yesPercent}%` }}
        />
      </div>
    </div>
  );
}

export default function PredMarketPage({ market }: Props) {
  const router = useRouter();
  const { isConnected } = useAccount();

  const [betAmount, setBetAmount] = useState("");
  const [betError, setBetError] = useState("");
  const [bettingSide, setBettingSide] = useState(true);
  const [pendingMarketId, setPendingMarketId] = useState<bigint | null>(null);
  const [phase, setPhase] = useState<"idle" | "awaiting-create" | "betting" | "done">("idle");

  // ── Tx 1: createMarket (pool-based, value = 0) ───────────────────────────
  const { writeContract: writeCreate, data: createHash, error: createError, isPending: isCreatePending } = useWriteContract();
  const { isLoading: isCreateConfirming, isSuccess: isCreateDone, data: createReceipt } =
    useWaitForTransactionReceipt({ hash: createHash });

  // ── Tx 2: placeBet ───────────────────────────────────────────────────────
  const { writeContract: writeBet, data: betHash, error: betError2, isPending: isBetPending } = useWriteContract();
  const { isLoading: isBetConfirming, isSuccess: isBetDone } =
    useWaitForTransactionReceipt({ hash: betHash });

  // After createMarket confirms → fire placeBet
  useEffect(() => {
    if (!isCreateDone || !createReceipt || phase !== "awaiting-create") return;
    let foundId: bigint | null = null;
    for (const log of createReceipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: MARKET_ABI, ...log });
        if (decoded.eventName === "MarketCreated") {
          foundId = (decoded.args as { marketId: bigint }).marketId;
          break;
        }
      } catch { /* skip */ }
    }
    if (foundId === null) {
      setBetError("Market created but could not read market ID.");
      setPhase("idle");
      return;
    }
    setPendingMarketId(foundId);
    setPhase("betting");
    writeBet({
      address: CONTRACT_ADDRESS,
      abi: MARKET_ABI,
      functionName: "placeBet",
      args: [foundId, bettingSide],
      value: parseUnits(betAmount, 18),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateDone, createReceipt]);

  // After placeBet confirms → navigate to on-chain market page
  useEffect(() => {
    if (!isBetDone || pendingMarketId === null) return;
    setPhase("done");
    router.push(`/market/${pendingMarketId}`);
  }, [isBetDone, pendingMarketId, router]);

  useEffect(() => {
    if (createError) { setBetError(createError.message.split("\n")[0]); setPhase("idle"); }
  }, [createError]);
  useEffect(() => {
    if (betError2) { setBetError(betError2.message.split("\n")[0]); setPhase("idle"); }
  }, [betError2]);

  function handleBet(isYes: boolean) {
    setBetError("");
    if (!isConnected) { setBetError("Connect your wallet first."); return; }
    if (!betAmount || Number(betAmount) <= 0) { setBetError("Enter a valid bet amount."); return; }
    setBettingSide(isYes);
    setPhase("awaiting-create");
    writeCreate({
      address: CONTRACT_ADDRESS,
      abi: MARKET_ABI,
      functionName: "createMarket",
      args: [
        market.title,
        BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
        false,
        "0x0000000000000000000000000000000000000000",
        market.yesLabel,
        market.noLabel,
        0n,
        0n,
      ],
      value: 0n,
    });
  }

  const isBusy = phase !== "idle" && phase !== "done";

  function statusLabel() {
    if (isCreatePending || isCreateConfirming || phase === "awaiting-create") return "Step 1/2: Creating market…";
    if (isBetPending || isBetConfirming || phase === "betting") return "Step 2/2: Placing bet…";
    if (phase === "done") return "Done! Redirecting…";
    return null;
  }

  const outcomes = (market.outcomes as Outcome[] | null) ?? [];
  const sorted = [...outcomes].sort((a, b) => b.probability - a.probability);
  const yesProb = Math.round(market.topProbability * 100);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Live
            </span>
            {market.categories.map((cat) => (
              <span key={cat} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 capitalize">
                {cat}
              </span>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-snug">{market.title}</h1>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span>Vol ${(market.volume / 1000).toFixed(1)}K</span>
            <span>24h ${(market.volume24h / 1000).toFixed(1)}K</span>
            <a href={market.predScopeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">
              PredScope →
            </a>
          </div>
        </div>

        {/* Odds display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">YES</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 truncate">{market.yesLabel}</p>
            <p className="text-xs text-zinc-400 mt-1">{yesProb}% chance</p>
          </div>
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 text-center">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">NO</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 truncate">{market.noLabel}</p>
            <p className="text-xs text-zinc-400 mt-1">{100 - yesProb}% chance</p>
          </div>
        </div>

        {/* Probability bar */}
        <PercentBar yesPercent={yesProb} />

        {/* All outcomes */}
        {sorted.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">All Outcomes</p>
            <div className="space-y-2">
              {sorted.map((o) => (
                <div key={o.title} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{o.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {Math.round(o.probability * 100)}%
                      </span>
                      {typeof o.day_change === "number" && o.day_change !== 0 && (
                        <span className={`text-xs ${o.day_change > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {o.day_change > 0 ? "+" : ""}{(o.day_change * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(o.probability * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bet panel */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Place a Bet</p>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">Amount (USDC)</label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={isBusy}
                className="w-full pr-16 pl-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">USDC</span>
            </div>
          </div>

          {isBusy && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
              <Spinner />
              <span>{statusLabel()}</span>
            </div>
          )}
          {betError && <p className="text-sm text-rose-600 dark:text-rose-400">{betError}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleBet(true)}
              disabled={isBusy || !betAmount}
              className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {isBusy && bettingSide ? <><Spinner /> {statusLabel()}</> : "Bet YES"}
            </button>
            <button
              onClick={() => handleBet(false)}
              disabled={isBusy || !betAmount}
              className="py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {isBusy && !bettingSide ? <><Spinner /> {statusLabel()}</> : "Bet NO"}
            </button>
          </div>

          <p className="text-xs text-zinc-400 text-center">
            Two wallet approvals: one to create the market, one to place your bet.
          </p>
        </div>

      </main>
    </div>
  );
}
