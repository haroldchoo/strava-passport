const requiredServerVariables = [
  "STRAVA_CLIENT_ID",
  "STRAVA_CLIENT_SECRET",
  "STRAVA_ALLOWED_ATHLETE_ID",
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
    allowedAthleteId: process.env.STRAVA_ALLOWED_ATHLETE_ID!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    sessionSecret: process.env.SESSION_SECRET!,
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY!,
  };
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
