import { NextResponse } from "next/server";
import { consumeVoteNonce, getActiveVoteNonce } from "@/lib/db-store";
import { isEvmAddress, normalizeAddress } from "@/lib/token";
import { recoverMessageAddress } from "viem";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { buildAuthSigningMessage } from "@/lib/auth-message";
import { setAuthSessionCookie } from "@/lib/session";

type VerifyBody = {
  wallet?: string;
  signature?: string;
  message?: string;
  nonce?: string;
};

const SIGNATURE_REGEX = /^0x[0-9a-f]+$/i;
const MAX_SIGNATURE_LENGTH = 4096;
const MAX_MESSAGE_LENGTH = 500;

function getRequestDomain(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) return forwardedHost;

  const host = req.headers.get("host");
  if (host) return host;

  return "unknown";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limitResult = checkRateLimit({
    key: `auth:verify:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many verify requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limitResult.retryAfterSeconds) },
      },
    );
  }

  const body = (await req.json().catch(() => ({}))) as VerifyBody;
  const { wallet, signature, message, nonce } = body;

  if (!wallet || !isEvmAddress(wallet)) {
    return NextResponse.json(
      { error: "Invalid wallet. Must be a valid EVM address." },
      { status: 400 },
    );
  }
  if (!signature || !message || !nonce) {
    return NextResponse.json(
      { error: "wallet, signature, message, nonce are required." },
      { status: 400 },
    );
  }
  if (!SIGNATURE_REGEX.test(signature)) {
    return NextResponse.json(
      { error: "Invalid signature format." },
      { status: 400 },
    );
  }
  if (signature.length < 10 || signature.length > MAX_SIGNATURE_LENGTH) {
    return NextResponse.json(
      { error: "Invalid signature length." },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `message is too long. Max ${MAX_MESSAGE_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (nonce.length > 128) {
    return NextResponse.json(
      { error: "nonce is too long." },
      { status: 400 },
    );
  }

  const normalizedWallet = normalizeAddress(wallet);
  const activeNonce = await getActiveVoteNonce({
    wallet: normalizedWallet,
    nonce,
  });
  if (!activeNonce) {
    return NextResponse.json(
      { error: "Invalid or expired nonce." },
      { status: 401 },
    );
  }

  const expectedMessage = buildAuthSigningMessage({
    domain: getRequestDomain(req),
    wallet: normalizedWallet,
    nonce,
    issuedAt: activeNonce.issuedAt,
    expiresAt: activeNonce.expiresAt,
  });
  if (message !== expectedMessage) {
    return NextResponse.json(
      { error: "Invalid signed message content." },
      { status: 400 },
    );
  }

  let recoveredWallet: string;
  try {
    recoveredWallet = normalizeAddress(
      await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 },
    );
  }
  if (recoveredWallet !== normalizedWallet) {
    return NextResponse.json(
      { error: "Signature does not match wallet." },
      { status: 401 },
    );
  }

  const nonceAccepted = await consumeVoteNonce({ nonceId: activeNonce.id });
  if (!nonceAccepted) {
    return NextResponse.json(
      { error: "Invalid or already-used nonce." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true, wallet: normalizedWallet });
  try {
    setAuthSessionCookie(res, normalizedWallet);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create auth session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return res;
}
