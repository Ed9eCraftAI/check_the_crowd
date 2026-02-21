import { NextResponse } from "next/server";
import { registerToken } from "@/lib/dev-store";
import { isChain, isEvmAddress, normalizeAddress } from "@/lib/token";

type RegisterBody = {
  chain?: string;
  address?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RegisterBody;
  const chain = body.chain;
  const address = body.address;

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

  const token = await registerToken(chain, normalizeAddress(address));

  return NextResponse.json({
    token: { chain: token.chain, address: token.address },
  });
}
