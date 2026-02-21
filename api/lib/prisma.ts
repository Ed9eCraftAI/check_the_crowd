import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
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

function createClient() {
  const rawConnectionString = env("DIRECT_URL") ?? env("DATABASE_URL");

  if (!rawConnectionString) {
    throw new Error(
      "DATABASE_URL or DIRECT_URL is required. Add it to the root .env file.",
    );
  }
  const connectionString = withLibpqCompat(rawConnectionString);

  const require = createRequire(import.meta.url);
  let PrismaPg: new (options: { connectionString: string }) => unknown;

  try {
    ({ PrismaPg } = require("@prisma/adapter-pg"));
  } catch {
    throw new Error(
      "Missing @prisma/adapter-pg. Install: cd pros-b-next && npm i pg @prisma/adapter-pg",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: env("NODE_ENV") === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createClient();

if (env("NODE_ENV") !== "production") {
  globalForPrisma.prisma = prisma;
}
