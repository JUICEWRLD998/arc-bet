import { NextResponse } from "next/server";
import { createPublicClient, http, defineChain } from "viem";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "@/lib/contracts";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Network Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

export interface OnchainMarket {
  id: number;
  question: string;
  creator: string;
  endTime: number;
  resolved: boolean;
  outcome: boolean;
  totalYesPool: string;
  totalNoPool: string;
  isPrivate: boolean;
}

export async function GET() {
  try {
    const count = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: "marketCount",
    });

    const total = Number(count);
    if (total === 0) {
      return NextResponse.json({ markets: [] });
    }

    const ids = Array.from({ length: total }, (_, i) => i + 1);

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const data = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PREDICTION_MARKET_ABI,
            functionName: "getMarket",
            args: [BigInt(id)],
          });
          const [question, creator, endTime, resolved, outcome, totalYesPool, totalNoPool, isPrivate] =
            data as unknown as [string, string, bigint, boolean, boolean, bigint, bigint, boolean, ...unknown[]];
          return {
            id,
            question,
            creator,
            endTime: Number(endTime),
            resolved,
            outcome,
            totalYesPool: totalYesPool.toString(),
            totalNoPool: totalNoPool.toString(),
            isPrivate,
          } satisfies OnchainMarket;
        } catch {
          return null;
        }
      })
    );

    const markets = results.filter(Boolean) as OnchainMarket[];
    return NextResponse.json({ markets });
  } catch {
    return NextResponse.json({ error: "Failed to fetch on-chain markets" }, { status: 502 });
  }
}
