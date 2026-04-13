import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PREDSCOPE_URL = "https://predscope.com/api/markets.json";
const CACHE_MINUTES = 10;
const UPSERT_BATCH = 100;

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

function calcOdds(probability: number): number {
  return Math.floor((1 / probability) * 95);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 24;
  const skip = (page - 1) * limit;

  // Check cache age
  const latest = await db.market.findFirst({
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });

  const ageMs = latest
    ? Date.now() - new Date(latest.syncedAt).getTime()
    : Infinity;
  const stale = ageMs > CACHE_MINUTES * 60 * 1000;

  if (stale) {
    const res = await fetch(PREDSCOPE_URL, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch predscope" }, { status: 502 });
    }
    const data: PredMarket[] = await res.json();
    const now = new Date();

    const rows = data
      .filter((m) => m.outcomes && m.outcomes.length >= 2)
      .map((m) => {
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
          outcomes: m.outcomes as unknown as Prisma.InputJsonValue,
          volume: m.volume ?? 0,
          volume24h: m.volume_24h ?? 0,
          liquidity: m.liquidity ?? 0,
          predScopeUrl: m.url ?? "",
          syncedAt: now,
        };
      });

    // Batch upserts — never overwrite onChainMarketId on resync
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows.slice(i, i + UPSERT_BATCH);
      await db.$transaction(
        batch.map((row) =>
          db.market.upsert({
            where: { slug: row.slug },
            create: row,
            update: {
              title: row.title,
              categories: row.categories,
              yesLabel: row.yesLabel,
              noLabel: row.noLabel,
              topProbability: row.topProbability,
              oddsYes: row.oddsYes,
              oddsNo: row.oddsNo,
              outcomes: row.outcomes,
              volume: row.volume,
              volume24h: row.volume24h,
              liquidity: row.liquidity,
              predScopeUrl: row.predScopeUrl,
              syncedAt: row.syncedAt,
              // onChainMarketId intentionally excluded
            },
          })
        )
      );
    }
  }

  const where: Prisma.MarketWhereInput =
    category !== "all" ? { categories: { has: category } } : {};

  const [rows2, count] = await db.$transaction([
    db.market.findMany({
      where,
      orderBy: { volume24h: "desc" },
      take: limit,
      skip,
    }),
    db.market.count({ where }),
  ]);

  return NextResponse.json({ markets: rows2, total: count, page, limit });
}


const PREDSCOPE_URL = "https://predscope.com/api/markets.json";
const CACHE_MINUTES = 10;

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

function calcOdds(probability: number): number {
  return Math.floor((1 / probability) * 95);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 24;
  const offset = (page - 1) * limit;

  // Check age of most recent row
  const [latest] = await db
    .select({ syncedAt: markets.syncedAt })
    .from(markets)
    .orderBy(sql`synced_at DESC`)
    .limit(1);

  const ageMs = latest
    ? Date.now() - new Date(latest.syncedAt).getTime()
    : Infinity;
  const stale = ageMs > CACHE_MINUTES * 60 * 1000;

  if (stale) {
    const res = await fetch(PREDSCOPE_URL, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch predscope" }, { status: 502 });
    }
    const data: PredMarket[] = await res.json();
    const now = new Date();

    // Build upsert values — only markets with ≥2 outcomes
    const rows = data
      .filter((m) => m.outcomes && m.outcomes.length >= 2)
      .map((m) => {
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
          outcomes: m.outcomes as unknown as object,
          volume: m.volume ?? 0,
          volume24h: m.volume_24h ?? 0,
          liquidity: m.liquidity ?? 0,
          predScopeUrl: m.url ?? "",
          syncedAt: now,
        };
      });

    if (rows.length > 0) {
      await db
        .insert(markets)
        .values(rows)
        .onConflictDoUpdate({
          target: markets.slug,
          set: {
            title: sql`EXCLUDED.title`,
            categories: sql`EXCLUDED.categories`,
            yesLabel: sql`EXCLUDED.yes_label`,
            noLabel: sql`EXCLUDED.no_label`,
            topProbability: sql`EXCLUDED.top_probability`,
            oddsYes: sql`EXCLUDED.odds_yes`,
            oddsNo: sql`EXCLUDED.odds_no`,
            outcomes: sql`EXCLUDED.outcomes`,
            volume: sql`EXCLUDED.volume`,
            volume24h: sql`EXCLUDED.volume_24h`,
            liquidity: sql`EXCLUDED.liquidity`,
            predScopeUrl: sql`EXCLUDED.predscope_url`,
            syncedAt: sql`EXCLUDED.synced_at`,
            // Do NOT overwrite on_chain_market_id on resync
          },
        });
    }
  }

  // Query with optional category filter
  const baseQuery = db
    .select()
    .from(markets);

  const filtered =
    category !== "all"
      ? baseQuery.where(sql`${markets.categories} @> ARRAY[${category}]::text[]`)
      : baseQuery;

  const rows2 = await filtered
    .orderBy(sql`volume_24h DESC`)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(markets)
    .$dynamic()
    .where(
      category !== "all"
        ? sql`${markets.categories} @> ARRAY[${category}]::text[]`
        : sql`1=1`
    );

  return NextResponse.json({ markets: rows2, total: count, page, limit });
}
