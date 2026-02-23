type EnvKey =
  | "CHECK_THE_CROWD_WALLETCONNECT_PROJECT_ID"
  | "CHECK_THE_CROWD_X_ACCOUNT"
  | "CHECK_THE_CROWD_APP_URL"
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "NODE_ENV";

const ENV: Record<EnvKey, string | undefined> = {
  CHECK_THE_CROWD_WALLETCONNECT_PROJECT_ID:
    process.env.CHECK_THE_CROWD_WALLETCONNECT_PROJECT_ID,
  CHECK_THE_CROWD_X_ACCOUNT: process.env.CHECK_THE_CROWD_X_ACCOUNT,
  CHECK_THE_CROWD_APP_URL: process.env.CHECK_THE_CROWD_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NODE_ENV: process.env.NODE_ENV,
};

export function env(key: EnvKey): string | undefined {
  return ENV[key];
}
