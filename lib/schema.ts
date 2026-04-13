export interface Market {
  slug: string;
  title: string;
  categories: string[];
  yesLabel: string;
  noLabel: string;
  topProbability: number;
  oddsYes: number;
  oddsNo: number;
  outcomes: unknown;
  volume: number;
  volume24h: number;
  liquidity: number;
  predScopeUrl: string;
  syncedAt: string;
  onChainMarketId: number | null;
}
