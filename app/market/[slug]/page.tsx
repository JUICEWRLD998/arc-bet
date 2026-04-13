import { notFound } from "next/navigation";
import OnchainMarketPage from "@/components/OnchainMarketPage";
import PredMarketPage from "@/components/PredMarketPage";
import type { Market } from "@/lib/schema";

const PREDSCOPE_URL = "https://predscope.com/api/markets.json";

interface PredOutcome {
  title: string;
  probability: number;
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

export default async function MarketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (/^\d+$/.test(slug)) {
    return <OnchainMarketPage marketId={BigInt(slug)} />;
  }

  const res = await fetch(PREDSCOPE_URL, { next: { revalidate: 600 } });
  if (!res.ok) notFound();

  const { markets: all }: { markets: PredMarket[] } = await res.json();
  const raw = all.find((m) => m.slug === slug);
  if (!raw) notFound();

  const sorted = [...raw.outcomes].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const prob = Math.max(0.01, Math.min(0.99, top.probability));

  const market: Market = {
    slug: raw.slug,
    title: raw.title,
    categories: raw.categories,
    yesLabel: top.title,
    noLabel: `${top.title} does not happen`,
    topProbability: prob,
    oddsYes: calcOdds(prob),
    oddsNo: calcOdds(1 - prob),
    outcomes: raw.outcomes,
    volume: raw.volume ?? 0,
    volume24h: raw.volume_24h ?? 0,
    liquidity: raw.liquidity ?? 0,
    predScopeUrl: raw.url ?? "",
    syncedAt: new Date().toISOString(),
    onChainMarketId: null,
  };

  return <PredMarketPage market={market} />;
}
