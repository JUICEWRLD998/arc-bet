import { db } from "@/lib/db";
import OnchainMarketPage from "@/components/OnchainMarketPage";
import PredMarketPage from "@/components/PredMarketPage";
import type { Market } from "@/lib/schema";

// Server component — resolves slug → on-chain numeric ID or predscope market
export default async function MarketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Legacy numeric IDs — route directly to the on-chain page
  if (/^\d+$/.test(slug)) {
    return <OnchainMarketPage marketId={BigInt(slug)} />;
  }

  // Predscope slug — fetch from Neon
  const market = await db.market.findUnique({ where: { slug } });

  if (!market) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400">Market not found.</p>
      </div>
    );
  }

  // Serialize Date for client component prop
  const serialized = {
    ...market,
    syncedAt: market.syncedAt.toISOString(),
  } as Market & { syncedAt: string };

  return <PredMarketPage market={serialized} />;
}

  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
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

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = BigInt(params.id as string);
  const { address, isConnected } = useAccount();

  const [betAmount, setBetAmount] = useState("");
  const [betError, setBetError] = useState("");
  const [resolveError, setResolveError] = useState("");
  const [activeBetSide, setActiveBetSide] = useState<"yes" | "no" | null>(null);
  const [activeTx, setActiveTx] = useState<"bet" | "resolve" | "claim" | null>(null);

  // ── Reads ────────────────────────────────────────────────────────────────
  const { data: marketData, refetch: refetchMarket } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarket",
    args: [marketId],
  });

  const { data: userBetData, refetch: refetchBet } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getUserBet",
    args: [marketId, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const { data: hasClaimed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "claimed",
    args: [marketId, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  // ── Writes ───────────────────────────────────────────────────────────────
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isConfirmed && activeTx) {
    refetchMarket();
    refetchBet();
  }

  // ── Derived state ────────────────────────────────────────────────────────
  if (!marketData) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-400">
            <Spinner />
            <span>Loading market…</span>
          </div>
        </main>
      </div>
    );
  }

  const [
    question,
    creator,
    endTime,
    resolved,
    outcome,
    totalYesPool,
    totalNoPool,
  ] = marketData;

  const totalPool = totalYesPool + totalNoPool;
  const yesPercent = totalPool > 0n ? Number((totalYesPool * 100n) / totalPool) : 50;
  const formattedYes = Number(formatUnits(totalYesPool, 6)).toFixed(2);
  const formattedNo = Number(formatUnits(totalNoPool, 6)).toFixed(2);
  const formattedTotal = Number(formatUnits(totalPool, 6)).toFixed(2);

  const now = Math.floor(Date.now() / 1000);
  const hasEnded = now >= Number(endTime);
  const isCreator = address?.toLowerCase() === creator.toLowerCase();

  const userBetAmount = userBetData?.[0] ?? 0n;
  const userBetSide = userBetData?.[1];
  const hasBet = userBetAmount > 0n;

  const formattedEndTime = new Date(Number(endTime) * 1000).toLocaleString();

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleBet(isYes: boolean) {
    setBetError("");
    if (!betAmount || Number(betAmount) <= 0) {
      setBetError("Enter a bet amount.");
      return;
    }
    const value = parseUnits(betAmount, 6);
    setActiveBetSide(isYes ? "yes" : "no");
    setActiveTx("bet");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: "placeBet",
      args: [marketId, isYes],
      value,
    });
  }

  function handleResolve(outcome: boolean) {
    setResolveError("");
    setActiveTx("resolve");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: "resolveMarket",
      args: [marketId, outcome],
    });
  }

  function handleClaim() {
    setActiveTx("claim");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: "claimWinnings",
      args: [marketId],
    });
  }

  const isBusy = isPending || isConfirming;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 space-y-8">
        {/* Market Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {resolved ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  outcome
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                }`}
              >
                Resolved: {outcome ? "YES" : "NO"}
              </span>
            ) : hasEnded ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Awaiting Resolution
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs text-zinc-400">Closes {formattedEndTime}</span>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
            {question}
          </h1>
        </div>

        {/* Pool Stats */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                YES Pool
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formattedYes}
              </p>
              <p className="text-xs text-zinc-400">USDC</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Total Pool
              </p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {formattedTotal}
              </p>
              <p className="text-xs text-zinc-400">USDC</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                NO Pool
              </p>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {formattedNo}
              </p>
              <p className="text-xs text-zinc-400">USDC</p>
            </div>
          </div>

          <PercentBar yesPercent={yesPercent} />
        </div>

        {/* User Bet Position */}
        {hasBet && (
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Your position
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {Number(formatUnits(userBetAmount, 6)).toFixed(2)} USDC on{" "}
                <span
                  className={
                    userBetSide
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-rose-600 dark:text-rose-400 font-semibold"
                  }
                >
                  {userBetSide ? "YES" : "NO"}
                </span>
              </p>
            </div>
            {resolved &&
              userBetSide === outcome &&
              !hasClaimed && (
                <button
                  onClick={handleClaim}
                  disabled={isBusy}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
                >
                  {isBusy && activeTx === "claim" ? <><Spinner /> Claiming…</> : "Claim Winnings"}
                </button>
              )}
            {resolved && hasClaimed && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Claimed
              </span>
            )}
            {resolved && userBetSide !== outcome && (
              <span className="text-xs text-rose-500 dark:text-rose-400 font-semibold">
                Lost
              </span>
            )}
          </div>
        )}

        {/* Betting Panel */}
        {!resolved && !hasEnded && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Place a Bet
            </h2>

            {hasBet ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You have already placed a bet on this market.
              </p>
            ) : !isConnected ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Connect your wallet to place a bet.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Amount (USDC)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 pr-16 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium">
                      USDC
                    </span>
                  </div>
                </div>

                {betError && (
                  <p className="text-sm text-rose-600 dark:text-rose-400">{betError}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleBet(true)}
                    disabled={isBusy}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {isBusy && activeBetSide === "yes" ? <Spinner /> : null}
                    Bet YES
                  </button>
                  <button
                    onClick={() => handleBet(false)}
                    disabled={isBusy}
                    className="py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {isBusy && activeBetSide === "no" ? <Spinner /> : null}
                    Bet NO
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Resolve Panel (Creator only) */}
        {isCreator && !resolved && hasEnded && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                Resolve Market
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                As the creator, select the correct outcome.
              </p>
            </div>

            {resolveError && (
              <p className="text-sm text-rose-600 dark:text-rose-400">{resolveError}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleResolve(true)}
                disabled={isBusy}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {isBusy && activeTx === "resolve" ? <Spinner /> : null}
                Resolve YES
              </button>
              <button
                onClick={() => handleResolve(false)}
                disabled={isBusy}
                className="py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {isBusy && activeTx === "resolve" ? <Spinner /> : null}
                Resolve NO
              </button>
            </div>
          </div>
        )}

        {/* TX feedback */}
        {txHash && !isConfirmed && (
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Spinner />
            Transaction submitted — waiting for confirmation…
          </div>
        )}
        {isConfirmed && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Transaction confirmed on Arc Network.
          </div>
        )}
      </main>
    </div>
  );
}
