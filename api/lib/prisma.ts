import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function withLibpqCompat(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    const hasCompat = url.searchParams.has("uselibpqcompat");

    if (sslmode === "require" && !hasCompat) {
      url.searchParams.set("uselibpqcompat", "true");
      return url.toString();
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}

function readEnvValue(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined;

  const content = readFileSync(filePath, "utf8");
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

function readConnectionStringFallback(): string | undefined {
  const cwd = process.cwd();
  const envCandidates = [path.join(cwd, ".env"), path.join(cwd, "..", ".env")];

  for (const envPath of envCandidates) {
    const directUrl = readEnvValue(envPath, "DIRECT_URL");
    if (directUrl) return directUrl;

    const databaseUrl = readEnvValue(envPath, "DATABASE_URL");
    if (databaseUrl) return databaseUrl;
  }

  return undefined;
}

function createClient() {
  const rawConnectionString =
    env("DIRECT_URL") ?? env("DATABASE_URL") ?? readConnectionStringFallback();

  if (!rawConnectionString) {
    throw new Error(
      "DATABASE_URL or DIRECT_URL is required. Set it in Vercel env vars or in api/.env (or root .env for local dev).",
    );
  }
  const connectionString = withLibpqCompat(rawConnectionString);

  const require = createRequire(import.meta.url);
  let PrismaPg: new (options: { connectionString: string }) => unknown;

  try {
    ({ PrismaPg } = require("@prisma/adapter-pg"));
  } catch {
    throw new Error(
      "Missing @prisma/adapter-pg. Install: cd api && npm i pg @prisma/adapter-pg",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter: adapter as never,
    log: env("NODE_ENV") === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createClient();

if (env("NODE_ENV") !== "production") {
  globalForPrisma.prisma = prisma;
}
