import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { isProduction, serverEnv } from "@/lib/env";

const sessionCookie = "strava_passport_session";
const oauthStateCookie = "strava_oauth_state";
const oauthInviteCookie = "strava_oauth_invite";

export type Session = { athleteId: string; stravaAthleteId: string };

function signingKey() {
  const value = serverEnv().sessionSecret;
  if (value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(sessionCookie)?.value;
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, signingKey(), { issuer: "strava-passport", audience: "private-beta" });
    if (typeof payload.sub !== "string" || typeof payload.stravaAthleteId !== "string") return null;
    return { athleteId: payload.sub, stravaAthleteId: payload.stravaAthleteId };
  } catch {
    return null;
  }
}

export async function setSession(session: Session) {
  const token = await new SignJWT({ stravaAthleteId: session.stravaAthleteId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.athleteId)
    .setIssuer("strava-passport")
    .setAudience("private-beta")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(signingKey());
  (await cookies()).set(sessionCookie, token, cookieOptions(60 * 60 * 24 * 7));
}

export async function clearSession() {
  (await cookies()).set(sessionCookie, "", cookieOptions(0));
}

export async function setOauthState(value: string, inviteCode?: string) {
  (await cookies()).set(oauthStateCookie, value, cookieOptions(60 * 10));
  if (inviteCode) (await cookies()).set(oauthInviteCookie, inviteCode, cookieOptions(60 * 10));
}

export async function consumeOauthState() {
  const store = await cookies();
  const value = store.get(oauthStateCookie)?.value ?? null;
  store.set(oauthStateCookie, "", cookieOptions(0));
  return value;
}

export async function consumeOauthInviteCode() {
  const store = await cookies();
  const value = store.get(oauthInviteCookie)?.value ?? null;
  store.set(oauthInviteCookie, "", cookieOptions(0));
  return value;
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/", maxAge };
}
