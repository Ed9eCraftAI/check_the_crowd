import { NextResponse } from "next/server";
import { getTokenConsensus } from "@/lib/dev-store";
import { isChain, isEvmAddress, normalizeAddress } from "@/lib/token";

type Params = {
  params: Promise<{
    chain: string;
    address: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  const resolved = await params;
  const chain = resolved.chain;
  const address = resolved.address;

  if (!isChain(chain)) {
    return NextResponse.json(
      { error: "Invalid chain. Use one of: eth, bsc" },
      { status: 400 },
    );
  }
  if (!isEvmAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address. Must be a valid EVM address." },
      { status: 400 },
    );
  }

  const result = await getTokenConsensus(chain, normalizeAddress(address));
  return NextResponse.json(result);
}
