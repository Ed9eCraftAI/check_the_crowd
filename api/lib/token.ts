import { createHash } from "node:crypto";

export type Chain = "eth" | "bsc";
export type VoteChoice = "appears_legit" | "suspicious" | "unclear";

export type TokenRecord = {
  chain: Chain;
  address: string;
  createdAt: string;
};

export type VoteRecord = {
  chain: Chain;
  address: string;
  voterWallet: string;
  choice: VoteChoice;
  signature: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

export type DevStore = {
  tokens: TokenRecord[];
  votes: VoteRecord[];
};

export const CHAINS: Chain[] = ["eth", "bsc"];

export function isChain(value: string): value is Chain {
  return CHAINS.includes(value as Chain);
}

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function hashWalletAddress(wallet: string): string {
  const normalized = normalizeAddress(wallet);
  return createHash("sha256").update(normalized).digest("hex");
}

export function toConsensusLabel(
  appearsLegit: number,
  suspicious: number,
  unclear: number,
): VoteChoice {
  const max = Math.max(appearsLegit, suspicious, unclear);

  if (max === 0) return "unclear";

  const winners = [appearsLegit, suspicious, unclear].filter(
    (count) => count === max,
  ).length;
  if (winners > 1) return "unclear";
  if (max === appearsLegit) return "appears_legit";
  if (max === suspicious) return "suspicious";
  return "unclear";
}
