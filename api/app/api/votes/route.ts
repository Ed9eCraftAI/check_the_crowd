import { NextResponse } from "next/server";
import { upsertVote } from "@/lib/dev-store";
import {
  isChain,
  isEvmAddress,
  normalizeAddress,
  type VoteChoice,
} from "@/lib/token";

type VoteBody = {
  chain?: string;
  address?: string;
  wallet?: string;
  choice?: string;
  signature?: string;
  message?: string;
};

const VOTE_CHOICES: VoteChoice[] = ["valid", "risky", "unknown"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as VoteBody;
  const { chain, address, wallet, choice, signature, message } = body;

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
      { error: "Invalid choice. Use one of: valid, risky, unknown" },
      { status: 400 },
    );
  }
  if (!signature || !message) {
    return NextResponse.json(
      { error: "signature and message are required." },
      { status: 400 },
    );
  }

  await upsertVote({
    chain,
    address: normalizeAddress(address),
    wallet: normalizeAddress(wallet),
    choice: choice as VoteChoice,
    signature,
    message,
  });

  return NextResponse.json({ ok: true });
}
