type EnvKey =
  | "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "NODE_ENV";

const ENV: Record<EnvKey, string | undefined> = {
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NODE_ENV: process.env.NODE_ENV,
};

export function env(key: EnvKey): string | undefined {
  return ENV[key];
}

