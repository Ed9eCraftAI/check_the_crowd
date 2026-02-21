export type Chain = "eth" | "bsc";
export type VoteChoice = "valid" | "risky" | "unknown";

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

export function toConsensusLabel(
  valid: number,
  risky: number,
  unknown: number,
): "VALID" | "RISKY" | "UNKNOWN" {
  const max = Math.max(valid, risky, unknown);

  if (max === 0) return "UNKNOWN";

  const winners = [valid, risky, unknown].filter((count) => count === max).length;
  if (winners > 1) return "UNKNOWN";
  if (max === valid) return "VALID";
  if (max === risky) return "RISKY";
  return "UNKNOWN";
}
