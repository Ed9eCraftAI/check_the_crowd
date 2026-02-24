import { NextResponse } from "next/server";
import { getSessionFromRequest, clearAuthSessionCookie } from "@/lib/session";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    wallet: session.wallet,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearAuthSessionCookie(res);
  return res;
}
