import { NextResponse } from "next/server";
import { issueVoteNonce } from "@/lib/dev-store";
import { isEvmAddress, normalizeAddress } from "@/lib/token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type NonceBody = {
  wallet?: string;
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limitResult = checkRateLimit({
    key: `auth:nonce:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many nonce requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limitResult.retryAfterSeconds) },
      },
    );
  }

  const body = (await req.json().catch(() => ({}))) as NonceBody;
  const wallet = body.wallet;

  if (!wallet || !isEvmAddress(wallet)) {
    return NextResponse.json(
      { error: "Invalid wallet. Must be a valid EVM address." },
      { status: 400 },
    );
  }

  const nonce = await issueVoteNonce(normalizeAddress(wallet));
  return NextResponse.json(nonce);
}
