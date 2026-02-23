import { NextResponse } from "next/server";
import {
  consumeVoteNonce,
  getActiveVoteNonce,
  getWalletVote,
  upsertVote,
} from "@/lib/dev-store";
import {
  isChain,
  isEvmAddress,
  normalizeAddress,
  type VoteChoice,
} from "@/lib/token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recoverMessageAddress } from "viem";
import { buildVoteSigningMessage } from "@/lib/sign-message";

type VoteBody = {
  chain?: string;
  address?: string;
  wallet?: string;
  choice?: string;
  signature?: string;
  message?: string;
  nonce?: string;
};

const VOTE_CHOICES: VoteChoice[] = ["appears_legit", "suspicious", "unclear"];
const MAX_MESSAGE_LENGTH = 500;
const SIGNATURE_REGEX = /^0x[0-9a-fA-F]{130}$/;

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
    key: `votes:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many vote requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limitResult.retryAfterSeconds) },
      },
    );
  }

  const body = (await req.json().catch(() => ({}))) as VoteBody;
  const { chain, address, wallet, choice, signature, message, nonce } = body;

  if (!chain || !isChain(chain)) {
    return NextResponse.json(
      { error: "Invalid chain. Use one of: eth, bsc" },
      { status: 400 },
    );
  }
  if (!address || !isEvmAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address. Must be a valid EVM address." },
      { status: 400 },
    );
  }
  if (!wallet || !isEvmAddress(wallet)) {
    return NextResponse.json(
      { error: "Invalid wallet. Must be a valid EVM address." },
      { status: 400 },
    );
  }
  if (!choice || !VOTE_CHOICES.includes(choice as VoteChoice)) {
    return NextResponse.json(
      {
        error:
          "Invalid choice. Use one of: appears_legit, suspicious, unclear",
      },
      { status: 400 },
    );
  }
  if (!signature || !message) {
    return NextResponse.json(
      { error: "signature and message are required." },
      { status: 400 },
    );
  }
  if (!nonce) {
    return NextResponse.json(
      { error: "nonce is required." },
      { status: 400 },
    );
  }
  if (!SIGNATURE_REGEX.test(signature)) {
    return NextResponse.json(
      { error: "Invalid signature format." },
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

  const normalizedChain = chain;
  const normalizedAddress = normalizeAddress(address);
  const normalizedWallet = normalizeAddress(wallet);
  const normalizedChoice = choice as VoteChoice;
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

  const expectedMessage = buildVoteSigningMessage({
    domain: getRequestDomain(req),
    chain: normalizedChain,
    address: normalizedAddress,
    choice: normalizedChoice,
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

  const nonceAccepted = await consumeVoteNonce({
    nonceId: activeNonce.id,
  });
  if (!nonceAccepted) {
    return NextResponse.json(
      { error: "Invalid or already-used nonce." },
      { status: 401 },
    );
  }

  await upsertVote({
    chain: normalizedChain,
    address: normalizedAddress,
    wallet: normalizedWallet,
    choice: normalizedChoice,
    signature,
    message,
    nonce,
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");
  const address = searchParams.get("address");
  const wallet = searchParams.get("wallet");

  if (!chain || !isChain(chain)) {
    return NextResponse.json(
      { error: "Invalid chain. Use one of: eth, bsc" },
      { status: 400 },
    );
  }
  if (!address || !isEvmAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address. Must be a valid EVM address." },
      { status: 400 },
    );
  }
  if (!wallet || !isEvmAddress(wallet)) {
    return NextResponse.json(
      { error: "Invalid wallet. Must be a valid EVM address." },
      { status: 400 },
    );
  }

  const existingVote = await getWalletVote({
    chain,
    address: normalizeAddress(address),
    wallet: normalizeAddress(wallet),
  });

  return NextResponse.json({
    vote: existingVote,
  });
}
