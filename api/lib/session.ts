import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isEvmAddress, normalizeAddress } from "@/lib/token";

export const AUTH_COOKIE_NAME = "check_the_crowd_session";
export const AUTH_SESSION_TTL_SECONDS = 24 * 60 * 60;

type SessionPayload = {
  wallet: string;
  iat: number;
  exp: number;
  v: 1;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function readRootEnvValue(key: string): string | undefined {
  const workspaceRoot = path.resolve(process.cwd(), "..");
  const rootEnvPath = path.join(workspaceRoot, ".env");
  if (!existsSync(rootEnvPath)) return undefined;

  const content = readFileSync(rootEnvPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [k, ...rest] = trimmed.split("=");
    if (k !== key) continue;
    const raw = rest.join("=").trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      return raw.slice(1, -1);
    }
    return raw;
  }

  return undefined;
}

function getSessionSecret(): string | null {
  const secret =
    env("CHECK_THE_CROWD_SESSION_SECRET") ??
    readRootEnvValue("CHECK_THE_CROWD_SESSION_SECRET");
  if (secret && secret.length >= 16) return secret;
  // if (env("NODE_ENV") !== "production") {
  //   return "check_the_crowd_dev_only_session_secret";
  // }
  return null;
}

function sign(data: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get("cookie");
  if (!raw) return {};

  const result: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    result[key] = decodeURIComponent(value);
  }
  return result;
}

export function createSessionToken(wallet: string): string {
  const normalizedWallet = normalizeAddress(wallet);
  if (!isEvmAddress(normalizedWallet)) {
    throw new Error("Invalid wallet for session token.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    wallet: normalizedWallet,
    iat: nowSec,
    exp: nowSec + AUTH_SESSION_TTL_SECONDS,
    v: 1,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  if (!signature) {
    throw new Error(
      "CHECK_THE_CROWD_SESSION_SECRET is required in production (min 16 chars).",
    );
  }
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, incomingSignature] = token.split(".");
  if (!encodedPayload || !incomingSignature) return null;

  const expectedSignature = sign(encodedPayload);
  if (!expectedSignature) return null;
  const incoming = Buffer.from(incomingSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (incoming.length !== expected.length) return null;
  if (!timingSafeEqual(incoming, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload || payload.v !== 1) return null;
    if (!payload.wallet || !isEvmAddress(payload.wallet)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

export function setAuthSessionCookie(res: NextResponse, wallet: string): void {
  const token = createSessionToken(wallet);
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env("NODE_ENV") === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_TTL_SECONDS,
  });
}

export function clearAuthSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env("NODE_ENV") === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
