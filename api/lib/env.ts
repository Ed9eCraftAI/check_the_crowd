type EnvKey =
  | "CHECK_THE_CROWD_WALLETCONNECT_PROJECT_ID"
  | "CHECK_THE_CROWD_X_ACCOUNT"
  | "CHECK_THE_CROWD_APP_URL"
  | "CHECK_THE_CROWD_SESSION_SECRET"
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "NODE_ENV";

export function env(key: EnvKey): string | undefined {
  return process.env[key];
}
