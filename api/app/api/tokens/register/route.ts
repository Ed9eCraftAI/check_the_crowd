import { NextResponse } from "next/server";
import { registerToken } from "@/lib/db-store";
import { isChain, isTokenAddressByChain, normalizeAddress } from "@/lib/token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type RegisterBody = {
  chain?: string;
  address?: string;
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limitResult = checkRateLimit({
    key: `tokens:register:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many register requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limitResult.retryAfterSeconds) },
      },
    );
  }

  const body = (await req.json().catch(() => ({}))) as RegisterBody;
  const chain = body.chain;
  const address = body.address;

  if (!chain || !isChain(chain)) {
    return NextResponse.json(
      { error: "Invalid chain. Use one of: eth, bsc, sol" },
      { status: 400 },
    );
  }
  if (!address || !isTokenAddressByChain(chain, address)) {
    return NextResponse.json(
      { error: "Invalid address for selected chain." },
      { status: 400 },
    );
  }

  const token = await registerToken(chain, normalizeAddress(address));

  return NextResponse.json({
    token: { chain: token.chain, address: token.address },
  });
}
