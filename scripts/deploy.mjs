/**
 * Deploy PredictionMarket to Arc Network testnet.
 * Usage: node scripts/deploy.mjs
 *
 * Reads OPERATOR_PRIVATE_KEY from .env.local.
 * Updates NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local after deploy.
 */

import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Load .env.local ─────────────────────────────────────────────────────────
const envPath = resolve(root, ".env.local");
const envContent = readFileSync(envPath, "utf8");

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!match) throw new Error(`Missing ${key} in .env.local`);
  return match[1].trim();
}

const privateKey = getEnv("OPERATOR_PRIVATE_KEY");
const rpcUrl = getEnv("NEXT_PUBLIC_ARC_RPC_URL");

// ── Load compiled artifact ───────────────────────────────────────────────────
const artifact = JSON.parse(
  readFileSync(resolve(root, "out/PredictionMarket.sol/PredictionMarket.json"), "utf8")
);
const bytecode = artifact.bytecode.object;
const abi = artifact.abi;

// ── Setup viem clients ───────────────────────────────────────────────────────
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Network Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

const account = privateKeyToAccount(privateKey);
console.log("Deploying from:", account.address);

const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });

// ── Check balance ────────────────────────────────────────────────────────────
const balance = await publicClient.getBalance({ address: account.address });
console.log("Balance:", Number(balance) / 1e18, "USDC");
if (balance === 0n) {
  console.error(
    "\nERROR: Wallet has 0 balance. Fund it first at https://faucet.circle.com/\n" +
    "Address to fund: " + account.address
  );
  process.exit(1);
}

// ── Deploy ───────────────────────────────────────────────────────────────────
console.log("Deploying PredictionMarket...");
const hash = await walletClient.deployContract({ abi, bytecode, args: [] });
console.log("Deploy tx:", hash);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
const newAddress = receipt.contractAddress;
if (!newAddress) throw new Error("No contract address in receipt");

console.log("\n✓ PredictionMarket deployed at:", newAddress);

// ── Update .env.local ────────────────────────────────────────────────────────
const updatedEnv = envContent.replace(
  /^NEXT_PUBLIC_CONTRACT_ADDRESS=.+$/m,
  `NEXT_PUBLIC_CONTRACT_ADDRESS=${newAddress}`
);
writeFileSync(envPath, updatedEnv, "utf8");
console.log("✓ Updated NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
console.log("\nRestart your dev server for the change to take effect.");
