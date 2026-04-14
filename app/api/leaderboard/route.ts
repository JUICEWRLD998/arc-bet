import { NextResponse } from "next/server";
import { createPublicClient, http, defineChain, parseAbiItem } from "viem";
import { CONTRACT_ADDRESS } from "@/lib/contracts";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Network Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
});

const BET_PLACED_EVENT = parseAbiItem(
  "event BetPlaced(uint256 indexed marketId, address indexed bettor, uint256 amount, bool isYes)"
);

export interface LeaderboardEntry {
  address: string;
  betsCount: number;
  totalWagered: string; // raw wei string – primary sort key
  largestBet: string;   // raw wei string – single biggest bet
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  scannedFromBlock: string;
  updatedAt: string;
}

const CHUNK_SIZE = 9_000n; // under the 10 000-block RPC limit
// Scan the most recent 500 000 blocks (~covers months of activity on Arc testnet).
// Adjust this constant if the contract was deployed earlier.
const SCAN_WINDOW = 500_000n;

async function fetchBetLogs(fromBlock: bigint, toBlock: bigint) {
  const all: Awaited<ReturnType<typeof client.getLogs<undefined, typeof BET_PLACED_EVENT>>> = [];
  let from = fromBlock;
  while (from <= toBlock) {
    const to = from + CHUNK_SIZE - 1n < toBlock ? from + CHUNK_SIZE - 1n : toBlock;
    const chunk = await client.getLogs({
      address: CONTRACT_ADDRESS,
      event: BET_PLACED_EVENT,
      fromBlock: from,
      toBlock: to,
    });
    all.push(...chunk);
    from = to + 1n;
  }
  return all;
}

export async function GET() {
  try {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock > SCAN_WINDOW ? latestBlock - SCAN_WINDOW : 1n;

    const betLogs = await fetchBetLogs(fromBlock, latestBlock);

    // Aggregate per address
    const stats = new Map<string, { betsCount: number; totalWagered: bigint; largestBet: bigint }>();

    for (const log of betLogs) {
      const { bettor, amount } = log.args as { bettor: `0x${string}`; amount: bigint };
      const addr = bettor.toLowerCase();
      const s = stats.get(addr) ?? { betsCount: 0, totalWagered: 0n, largestBet: 0n };
      s.betsCount += 1;
      s.totalWagered += amount;
      if (amount > s.largestBet) s.largestBet = amount;
      stats.set(addr, s);
    }

    // Sort by total wagered desc, largest single bet as tiebreaker
    const entries: LeaderboardEntry[] = Array.from(stats.entries())
      .map(([address, s]) => ({
        address,
        betsCount: s.betsCount,
        totalWagered: s.totalWagered.toString(),
        largestBet: s.largestBet.toString(),
      }))
      .sort((a, b) => {
        const diff = BigInt(b.totalWagered) - BigInt(a.totalWagered);
        if (diff !== 0n) return diff > 0n ? 1 : -1;
        const diff2 = BigInt(b.largestBet) - BigInt(a.largestBet);
        return diff2 > 0n ? 1 : diff2 < 0n ? -1 : 0;
      })
      .slice(0, 100);

    return NextResponse.json({
      entries,
      scannedFromBlock: fromBlock.toString(),
      updatedAt: new Date().toISOString(),
    } satisfies LeaderboardResponse);
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
