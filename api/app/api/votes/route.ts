import { NextResponse } from "next/server";
import {
  getWalletVote,
  upsertVote,
} from "@/lib/db-store";
import {
  isChain,
  isEvmAddress,
  isTokenAddressByChain,
  normalizeAddress,
  type VoteChoice,
} from "@/lib/token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type VoteBody = {
  chain?: string;
  address?: string;
  wallet?: string;
  choice?: string;
};

const VOTE_CHOICES: VoteChoice[] = ["appears_legit", "suspicious", "unclear"];

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
  const { chain, address, wallet, choice } = body;

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
  const normalizedChain = chain;
  const normalizedAddress = normalizeAddress(address);
  const normalizedWallet = normalizeAddress(wallet);
  const normalizedChoice = choice as VoteChoice;

  await upsertVote({
    chain: normalizedChain,
    address: normalizedAddress,
    wallet: normalizedWallet,
    choice: normalizedChoice,
    signature: "signature_removed",
    message: "signature_removed",
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
