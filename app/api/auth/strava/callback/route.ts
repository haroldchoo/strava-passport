import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { createSyncJob, saveOauthConnection } from "@/lib/repository";
import { consumeOauthState, setSession } from "@/lib/session";
import { exchangeAuthorizationCode, revokeToken } from "@/lib/strava";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const expectedState = await consumeOauthState();
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const denied = request.nextUrl.searchParams.get("error");

  if (denied) return redirectWithError(env.appUrl, "Strava access was not approved.");
  if (!expectedState || !returnedState || expectedState !== returnedState) return redirectWithError(env.appUrl, "OAuth state validation failed.");
  if (!code) return redirectWithError(env.appUrl, "Strava did not return an authorization code.");

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const scopeValue = request.nextUrl.searchParams.get("scope") || tokens.scope || "";
    const scopes = scopeValue.split(/[\s,]+/).filter(Boolean);
    if (!scopes.includes("activity:read_all")) {
      await revokeToken(tokens.refresh_token);
      return redirectWithError(env.appUrl, "Private activity access is required for this beta.");
    }
    if (String(tokens.athlete.id) !== env.allowedAthleteId) {
      await revokeToken(tokens.refresh_token);
      return redirectWithError(env.appUrl, "This private beta is restricted to its configured athlete.");
    }

    const session = await saveOauthConnection(tokens, scopes);
    await setSession(session);
    await createSyncJob(session.athleteId);
    const destination = new URL(env.appUrl);
    destination.searchParams.set("connected", "1");
    destination.hash = "dashboard";
    return NextResponse.redirect(destination);
  } catch (error) {
    return redirectWithError(env.appUrl, error instanceof Error ? error.message : "Strava connection failed.");
  }
}

function redirectWithError(appUrl: string, message: string) {
  const destination = new URL(appUrl);
  destination.searchParams.set("oauth_error", message);
  destination.hash = "dashboard";
  return NextResponse.redirect(destination);
}
