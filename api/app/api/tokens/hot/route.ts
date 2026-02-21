import { NextResponse } from "next/server";
import { getWhatsHotTokens } from "@/lib/dev-store";

export async function GET(req: Request) {
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
