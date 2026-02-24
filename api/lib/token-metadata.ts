import { normalizeAddress, type Chain } from "@/lib/token";

export type TokenMetadata = {
  symbol: string;
  name: string;
};

type DexScreenerToken = {
  address?: string;
  symbol?: string;
  name?: string;
};

type DexScreenerPair = {
  chainId?: string;
  baseToken?: DexScreenerToken;
  quoteToken?: DexScreenerToken;
  liquidity?: {
    usd?: number;
  };
  volume?: {
    h24?: number;
  };
};

type DexScreenerResponse = {
  pairs?: DexScreenerPair[];
};

const DEXSCREENER_CHAIN_BY_KEY: Record<Chain, string> = {
  eth: "ethereum",
  bsc: "bsc",
  sol: "solana",
};

export async function getTokenMetadataFromDexScreener(input: {
  chain: Chain;
  address: string;
}): Promise<TokenMetadata | null> {
  const normalizedAddress = normalizeAddress(input.address);
  const targetChainId = DEXSCREENER_CHAIN_BY_KEY[input.chain];

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${normalizedAddress}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as DexScreenerResponse;
    const pairs = Array.isArray(data.pairs) ? data.pairs : [];

    const ranked = pairs
      .filter((pair) => pair.chainId === targetChainId)
      .map((pair) => {
        const baseAddress = normalizeAddress(pair.baseToken?.address ?? "");
        const quoteAddress = normalizeAddress(pair.quoteToken?.address ?? "");
        const matchedToken =
          baseAddress === normalizedAddress ? pair.baseToken : quoteAddress === normalizedAddress ? pair.quoteToken : null;
        return {
          matchedToken,
          liquidityUsd: Number(pair.liquidity?.usd ?? 0),
          volume24h: Number(pair.volume?.h24 ?? 0),
        };
      })
      .filter((item) => item.matchedToken)
      .sort((a, b) => {
        if (b.liquidityUsd !== a.liquidityUsd) return b.liquidityUsd - a.liquidityUsd;
        return b.volume24h - a.volume24h;
      });

    const top = ranked[0]?.matchedToken;
    const symbol = top?.symbol?.trim() ?? "";
    const name = top?.name?.trim() ?? "";
    if (!symbol && !name) return null;

    return {
      symbol: symbol || "-",
      name: name || symbol || "-",
    };
  } catch {
    return null;
  }
}
