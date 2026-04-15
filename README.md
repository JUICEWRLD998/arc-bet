# Arc Bet — Prediction Markets on Arc Network

A decentralized prediction market platform built on Arc Network using Next.js and Foundry. Users can create YES/NO markets, place bets, and claim winnings using native USDC.

## Features

- **Create Markets**: Launch custom prediction markets with automatic or manual resolution
- **Place Bets**: Bet on existing markets with transparent odds and pool-based or fixed-odds payouts
- **Fixed-Odds Markets**: Sourced from PredScope with pre-calculated odds
- **Pool-Based Markets**: User-created markets with proportional payout mechanics
- **Leaderboard**: Track top predictors by winnings
- **Private Markets**: Restrict participation to specific addresses
- **On-Chain Resolution**: Markets resolved and settled directly via smart contract

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Blockchain**: Solidity 0.8.20 (Arc Network, native USDC)
- **Web3**: wagmi, Viem, RainbowKit, ConnectKit
- **Database**: Prisma + PostgreSQL (Neon)
- **Smart Contracts**: Foundry (Forge), Solidity
- **ORM**: Drizzle ORM (alternative connector)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Foundry (for contract development)
- NEXT_PUBLIC_CONTRACT_ADDRESS environment variable

### Installation

```bash
# Install dependencies
npm install

# Set up Prisma database
npm run db:push
```

### Development

```bash
# Start dev server
npm run dev

# Open browser
open http://localhost:3000
```

### Smart Contracts

```bash
# Build contracts
forge build

# Run tests
forge test

# Deploy
forge script script/DeployPredictionMarket.s.sol --rpc-url <RPC_URL> --private-key <PRIVATE_KEY> --broadcast
```

## Project Structure

```
app/                      # Next.js app directory
├── api/                  # API routes (markets sync, activation, on-chain)
├── create/               # Create market page
├── leaderboard/          # Top predictors
├── market/               # Market details & betting
├── my-bets/              # User's active positions
components/               # React components
├── PredMarketPage.tsx    # Sourced market UI (create + bet flow)
├── OnchainMarketPage.tsx # On-chain market UI (direct betting)
lib/                      # Utilities
├── contracts.ts          # ABI & contract address
├── schema.ts             # Data types
├── db.ts                 # Prisma client
src/                      # Solidity smart contracts
├── PredictionMarket.sol  # Main market contract
test/                     # Foundry tests
```

## Market Types

### Fixed-Odds (Sourced)
- Pre-created by operators with calculated odds from external sources (PredScope)
- Operators fund a house pool to back potential payouts
- Payouts: `betAmount × (odds / 100)`
- Created via `/api/markets/activate`

### Pool-Based (Custom)
- Created by users on the create page
- No operator pool; payouts come from losing side
- Payouts: `(yourBet / winningPool) × totalPool`
- Anyone can participate and resolve

## Key Functions

### Create Market
```typescript
createMarket(
  question: string,
  endTime: uint256,
  isPrivate: bool,
  allowedAddress: address,
  yesLabel: string,
  noLabel: string,
  oddsYes: uint256,   // 0 for pool-based
  oddsNo: uint256     // 0 for pool-based
) payable → marketId
```

### Place Bet
```typescript
placeBet(marketId: uint256, isYes: bool) payable
```
Sends native USDC as bet amount via `msg.value`

### Resolve Market
Only callable by creator after betting period ends.

### Claim Winnings
Winners retrieve payouts after market resolution.

## Environment Variables

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
DATABASE_URL=postgresql://...
NEXT_PUBLIC_WALLET_CONNECT_ID=...
```

## Testing

```bash
# Run all tests
forge test

# Run specific test
forge test --match testName

# Verbose output
forge test -vv

# Gas usage
forge test --gas-report
```

## Development Notes

- Markets created from `/create` page: pool-based (oddsYes=0, oddsNo=0, initialBet=0)
- Markets from PredScope: fixed-odds with house pool and creator initial stake
- All bets use native token (USDC on Arc) via `msg.value`
- Creator must place first bet as part of market creation flow
