const requiredServerVariables = [
  "STRAVA_CLIENT_ID",
  "STRAVA_CLIENT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export function serverEnv() {
  const missing = requiredServerVariables.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing server environment variables: ${missing.join(", ")}`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    appUrl: new URL(appUrl).origin,
    stravaClientId: process.env.STRAVA_CLIENT_ID!,
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    sessionSecret: process.env.SESSION_SECRET!,
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY!,
    syncWorkerSecret: process.env.SYNC_WORKER_SECRET ?? "",
    syncBatchSize: numberEnv("SYNC_BATCH_SIZE", 4),
    syncMaxPagesPerRun: numberEnv("SYNC_MAX_PAGES_PER_RUN", 8),
  };
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
