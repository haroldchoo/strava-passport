import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizationUrl } from "@/lib/strava";
import { setOauthState } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const state = randomBytes(32).toString("base64url");
  await setOauthState(state);
  return NextResponse.redirect(authorizationUrl(state));
}
