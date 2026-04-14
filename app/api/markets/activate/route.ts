import { NextRequest, NextResponse } from "next/server";
import { parseAbi } from "viem";

const PREDSCOPE_URL = "https://predscope.com/api/markets.json";

export const ACTIVATE_ABI = parseAbi([
  "function createMarket(string question, uint256 endTime, bool isPrivate, address allowedAddress, string yesLabel, string noLabel, uint256 oddsYes, uint256 oddsNo) payable returns (uint256 marketId)",
]);

const MARKET_DURATION_SECS = 30 * 24 * 60 * 60; // 30 days

// Returns market params for the client to sign with their own wallet
export async function POST(req: NextRequest) {
  const { slug } = await req.json() as { slug: string };
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    const psRes = await fetch(PREDSCOPE_URL, { next: { revalidate: 600 } });
    if (!psRes.ok) {
      return NextResponse.json({ error: "Failed to fetch markets" }, { status: 502 });
    }
    const { markets: all } = await psRes.json();
    const raw = (all as { slug: string; title: string; outcomes: { probability: number; title: string }[] }[])
      .find((m) => m.slug === slug);
    if (!raw) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const sorted = [...raw.outcomes].sort((a, b) => b.probability - a.probability);
    const top = sorted[0];
    // Clamp to [0.06, 0.94] so that (1/p)*95 and (1/(1-p))*95 are always > 100
    // (contract requires oddsYes > 100 and oddsNo > 100)
    const prob = Math.max(0.06, Math.min(0.94, top.probability));
    const oddsYes = Math.max(101, Math.floor((1 / prob) * 95));
    const oddsNo = Math.max(101, Math.floor((1 / (1 - prob)) * 95));
    const endTime = Math.floor(Date.now() / 1000) + MARKET_DURATION_SECS;

    return NextResponse.json({
      question: raw.title,
      yesLabel: top.title,
      noLabel: `${top.title} does not happen`,
      oddsYes,
      oddsNo,
      endTime,
    });
  } catch (error) {
    console.error("Error preparing market activation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
