import { NextRequest, NextResponse } from "next/server";
import type { Market } from "@/lib/schema";

const PREDSCOPE_URL = "https://predscope.com/api/markets.json";

interface PredOutcome {
  title: string;
  probability: number;
  day_change: number;
}

interface PredMarket {
  title: string;
  slug: string;
  url: string;
  volume: number;
  volume_24h: number;
  liquidity: number;
  categories: string[];
  outcomes: PredOutcome[];
}

function calcOdds(p: number): number {
  return Math.floor((1 / p) * 95);
}

function transform(m: PredMarket): Market {
  const sorted = [...m.outcomes].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const prob = Math.max(0.01, Math.min(0.99, top.probability));
  return {
    slug: m.slug,
    title: m.title,
    categories: m.categories,
    yesLabel: top.title,
    noLabel: `${top.title} does not happen`,
    topProbability: prob,
    oddsYes: calcOdds(prob),
    oddsNo: calcOdds(1 - prob),
    outcomes: m.outcomes,
    volume: m.volume ?? 0,
    volume24h: m.volume_24h ?? 0,
    liquidity: m.liquidity ?? 0,
    predScopeUrl: m.url ?? "",
    syncedAt: new Date().toISOString(),
    onChainMarketId: null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 24;

  // Next.js caches this fetch for 10 minutes -- no DB needed
  const res = await fetch(PREDSCOPE_URL, { next: { revalidate: 600 } });
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 502 });
  }

  const { markets: raw }: { markets: PredMarket[] } = await res.json();
  const all = raw
    .filter((m) => m.outcomes && m.outcomes.length >= 2)
    .map(transform);

  const filtered =
    category !== "all" ? all.filter((m) => m.categories.includes(category)) : all;

  const total = filtered.length;
  const markets = filtered
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice((page - 1) * limit, page * limit);

  return NextResponse.json({ markets, total, page, limit });
}

export async function POST() {
  return NextResponse.json({ ok: true, message: "Cache will refresh on next request" });
}
