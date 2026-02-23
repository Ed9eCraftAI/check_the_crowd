import { NextResponse } from "next/server";
import { getWhatsHotTokens } from "@/lib/db-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limitResult = checkRateLimit({
    key: `tokens:hot:${ip}`,
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

  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  const rawPage = searchParams.get("page");
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 20;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const limit = Number.isNaN(parsed) ? 20 : parsed;
  const page = Number.isNaN(parsedPage) ? 1 : parsedPage;

  const result = await getWhatsHotTokens(limit, page);
  return NextResponse.json(result);
}
