import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, parseAbi, parseUnits, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PREDSCOPE_URL = "https://predscope.com/api/markets.json";

const arcTestnet = {
  id: 5042002,
  name: "Arc Network Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.arc-testnet.io"] },
  },
} as const;

const ABI_SNIPPET = parseAbi([
  "function createMarket(string question, uint256 endTime, bool isPrivate, address allowedAddress, string yesLabel, string noLabel, uint256 oddsYes, uint256 oddsNo) payable returns (uint256 marketId)",
  "event MarketCreated(uint256 indexed marketId, address indexed creator, string question, uint256 endTime, bool isPrivate, address allowedAddress)",
]);

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "") as `0x${string}`;
// Default house pool: 50 USDC (6 decimals)
const HOUSE_POOL = parseUnits(
  process.env.INITIAL_HOUSE_POOL_USDC ?? "50",
  6
);
// Markets expire 30 days from activation by default
const MARKET_DURATION_SECS = BigInt(30 * 24 * 60 * 60);

export async function POST(req: NextRequest) {
  const { slug } = await req.json() as { slug: string };
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  // Fetch market details directly from predscope (cached)
  const psRes = await fetch(PREDSCOPE_URL, { next: { revalidate: 600 } });
  if (!psRes.ok) {
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 502 });
  }
  const { markets: all } = await psRes.json();
  const raw = (all as { slug: string }[]).find((m) => m.slug === slug);
  if (!raw) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const sorted = [...(raw.outcomes as { probability: number; title: string }[])]
    .sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const prob = Math.max(0.01, Math.min(0.99, top.probability));
  const oddsYes = Math.floor((1 / prob) * 95);
  const oddsNo = Math.floor((1 / (1 - prob)) * 95);

  const privKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!privKey) {
    return NextResponse.json({ error: "OPERATOR_PRIVATE_KEY not configured" }, { status: 500 });
  }

  const account = privateKeyToAccount(privKey as `0x${string}`);
  const client = createWalletClient({ account, chain: arcTestnet, transport: http() });

  const endTime = BigInt(Math.floor(Date.now() / 1000)) + MARKET_DURATION_SECS;

  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    abi: ABI_SNIPPET,
    functionName: "createMarket",
    args: [
      raw.title,
      endTime,
      false,
      "0x0000000000000000000000000000000000000000",
      top.title,
      `${top.title} does not happen`,
      BigInt(oddsYes),
      BigInt(oddsNo),
    ],
    value: HOUSE_POOL,
  });

  // Poll for receipt to get marketId from event
  const { createPublicClient } = await import("viem");
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  let onChainMarketId: number | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: ABI_SNIPPET, ...log });
      if (decoded.eventName === "MarketCreated") {
        onChainMarketId = Number((decoded.args as { marketId: bigint }).marketId);
        break;
      }
    } catch {
      // skip non-matching logs
    }
  }

  if (onChainMarketId === null) {
    return NextResponse.json({ error: "Could not parse MarketCreated event" }, { status: 500 });
  }

  return NextResponse.json({ marketId: onChainMarketId });
}
