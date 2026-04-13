export function FaucetBanner() {
  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-linear-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        {/* Coin icon */}
        <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">
          $
        </div>
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            Need test USDC?
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            Paste your wallet address at the Circle faucet to receive USDC on
            Arc Network.
          </p>
        </div>
      </div>

      <a
        href="https://faucet.circle.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
      >
        Get Test USDC
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 7h10v10M7 17 17 7" />
        </svg>
      </a>
    </div>
  );
}
