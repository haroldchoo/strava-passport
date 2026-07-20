import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizationUrl } from "@/lib/strava";
import { setOauthState } from "@/lib/session";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const inviteCode = request.nextUrl.searchParams.get("invite") ?? "";
  if (!inviteCode.trim()) {
    const destination = new URL(serverEnv().appUrl);
    destination.searchParams.set("oauth_error", "An invite code is required to join this beta.");
    destination.hash = "dashboard";
    return NextResponse.redirect(destination);
  }
  const state = randomBytes(32).toString("base64url");
  await setOauthState(state, inviteCode);
  return NextResponse.redirect(authorizationUrl(state));
}
