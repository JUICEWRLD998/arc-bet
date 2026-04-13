export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const PREDICTION_MARKET_ABI = [
  // ─── State Variables ────────────────────────────────────────────────────
  {
    inputs: [],
    name: "marketCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // ─── createMarket ───────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: "string", name: "question", type: "string" },
      { internalType: "uint256", name: "endTime", type: "uint256" },
      { internalType: "bool", name: "isPrivate", type: "bool" },
      { internalType: "address", name: "allowedAddress", type: "address" },
    ],
    name: "createMarket",
    outputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ─── placeBet ────────────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "bool", name: "isYes", type: "bool" },
    ],
    name: "placeBet",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },

  // ─── resolveMarket ───────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "bool", name: "outcome", type: "bool" },
    ],
    name: "resolveMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ─── claimWinnings ───────────────────────────────────────────────────────
  {
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    name: "claimWinnings",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ─── getMarket ───────────────────────────────────────────────────────────
  {
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    name: "getMarket",
    outputs: [
      { internalType: "string", name: "question", type: "string" },
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "uint256", name: "endTime", type: "uint256" },
      { internalType: "bool", name: "resolved", type: "bool" },
      { internalType: "bool", name: "outcome", type: "bool" },
      { internalType: "uint256", name: "totalYesPool", type: "uint256" },
      { internalType: "uint256", name: "totalNoPool", type: "uint256" },
      { internalType: "bool", name: "isPrivate", type: "bool" },
      { internalType: "address", name: "allowedAddress", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ─── getUserBet ──────────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "address", name: "user", type: "address" },
    ],
    name: "getUserBet",
    outputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bool", name: "isYes", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ─── claimed (public mapping getter) ────────────────────────────────────
  {
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "address", name: "user", type: "address" },
    ],
    name: "claimed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ─── Events ──────────────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "marketId", type: "uint256" },
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: false, internalType: "string", name: "question", type: "string" },
      { indexed: false, internalType: "uint256", name: "endTime", type: "uint256" },
      { indexed: false, internalType: "bool", name: "isPrivate", type: "bool" },
      { indexed: false, internalType: "address", name: "allowedAddress", type: "address" },
    ],
    name: "MarketCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "marketId", type: "uint256" },
      { indexed: true, internalType: "address", name: "bettor", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "bool", name: "isYes", type: "bool" },
    ],
    name: "BetPlaced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "marketId", type: "uint256" },
      { indexed: false, internalType: "bool", name: "outcome", type: "bool" },
    ],
    name: "MarketResolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "marketId", type: "uint256" },
      { indexed: true, internalType: "address", name: "claimer", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "WinningsClaimed",
    type: "event",
  },
] as const;
