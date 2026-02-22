import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const PROJECT_ID_KEY = "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID";
const X_ACCOUNT_KEY = "NEXT_PUBLIC_X_ACCOUNT";

function env(key: string): string | undefined {
  return process.env[key];
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

const workspaceRoot = path.resolve(process.cwd(), "..");
const rootEnvPath = path.join(workspaceRoot, ".env");

const fallbackProjectId =
  env(PROJECT_ID_KEY) ??
  readEnvValue(rootEnvPath, PROJECT_ID_KEY);
const fallbackXAccount =
  env(X_ACCOUNT_KEY) ??
  readEnvValue(rootEnvPath, X_ACCOUNT_KEY);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: fallbackProjectId,
    NEXT_PUBLIC_X_ACCOUNT: fallbackXAccount,
  },
};

export default nextConfig;
