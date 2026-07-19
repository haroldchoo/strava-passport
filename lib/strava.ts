import "server-only";
import { serverEnv } from "@/lib/env";

const apiBase = "https://www.strava.com/api/v3";
const oauthBase = "https://www.strava.com/oauth";

export type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete: {
    id: number;
    firstname?: string;
    lastname?: string;
    username?: string;
    profile?: string;
  };
};

export type StravaActivity = {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  manual?: boolean;
  commute?: boolean;
  trainer?: boolean;
  start_latlng?: [number, number] | null;
};

export class StravaApiError extends Error {
  constructor(message: string, public status: number, public retryAfterSeconds: number | null = null) {
    super(message);
  }
}

export function authorizationUrl(state: string) {
  const env = serverEnv();
  const url = new URL(`${oauthBase}/authorize`);
  url.search = new URLSearchParams({
    client_id: env.stravaClientId,
    redirect_uri: `${env.appUrl}/api/auth/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  }).toString();
  return url;
}

export async function exchangeAuthorizationCode(code: string): Promise<StravaTokenResponse> {
  const env = serverEnv();
  return tokenRequest({ client_id: env.stravaClientId, client_secret: env.stravaClientSecret, code, grant_type: "authorization_code" });
}

export async function refreshAccessToken(refreshToken: string): Promise<Omit<StravaTokenResponse, "athlete">> {
  const env = serverEnv();
  return tokenRequest({ client_id: env.stravaClientId, client_secret: env.stravaClientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
}

export async function listAthleteActivities(accessToken: string, page: number, perPage = 200) {
  const url = new URL(`${apiBase}/athlete/activities`);
  url.search = new URLSearchParams({ page: String(page), per_page: String(perPage) }).toString();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw await apiError(response, "Unable to fetch Strava activities");
  return (await response.json()) as StravaActivity[];
}

export async function revokeToken(token: string) {
  const env = serverEnv();
  const response = await fetch(`${oauthBase}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.stravaClientId}:${env.stravaClientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token, token_type_hint: "refresh_token" }),
  });
  if (!response.ok) throw await apiError(response, "Unable to revoke Strava access");
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(`${oauthBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!response.ok) throw await apiError(response, "Strava token exchange failed");
  return (await response.json()) as StravaTokenResponse;
}

async function apiError(response: Response, fallback: string) {
  let detail = fallback;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) detail = `${fallback}: ${body.message}`;
  } catch {
    // Strava sometimes returns an empty response for infrastructure errors.
  }
  const retryAfter = parseRetryAfter(response.headers);
  return new StravaApiError(detail, response.status, retryAfter);
}

function parseRetryAfter(headers: Headers) {
  const direct = Number(headers.get("retry-after"));
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (headers.get("x-ratelimit-usage")) return 15 * 60;
  return null;
}
