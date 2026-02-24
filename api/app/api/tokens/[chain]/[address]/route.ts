import { NextResponse } from "next/server";
import { getTokenConsensus } from "@/lib/db-store";
import { isChain, isTokenAddressByChain, normalizeAddress } from "@/lib/token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getTokenMetadataFromDexScreener } from "@/lib/token-metadata";

type Params = {
  params: Promise<{
    chain: string;
    address: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  const ip = getClientIp(_);
  const limitResult = checkRateLimit({
    key: `tokens:consensus:${ip}`,
    limit: 120,
    windowMs: 60_000,
  });

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limitResult.retryAfterSeconds) },
      },
    );
  }

  const resolved = await params;
  const chain = resolved.chain;
  const address = resolved.address;

  if (!isChain(chain)) {
    return NextResponse.json(
      { error: "Invalid chain. Use one of: eth, bsc, sol" },
      { status: 400 },
    );
  }
  if (!isTokenAddressByChain(chain, address)) {
    return NextResponse.json(
      { error: "Invalid address for selected chain." },
      { status: 400 },
    );
  }

  const normalizedAddress = normalizeAddress(address);
  const [result, metadata] = await Promise.all([
    getTokenConsensus(chain, normalizedAddress),
    getTokenMetadataFromDexScreener({ chain, address: normalizedAddress }),
  ]);
  return NextResponse.json({
    ...result,
    metadata,
  });
}
