import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { hashInviteCode, normalizeInviteCode } from "@/lib/repository";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type InviteRequest = {
  expiresInDays?: unknown;
};

export async function POST(request: Request) {
  const env = serverEnv();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.inviteAdminSecret) return NextResponse.json({ error: "Invite admin secret is not configured" }, { status: 500 });
  if (token !== env.inviteAdminSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readBody(request);
  const expiresInDays = Number(body.expiresInDays ?? 30);
  const safeDays = Number.isFinite(expiresInDays) && expiresInDays > 0 ? Math.min(Math.floor(expiresInDays), 365) : 30;
  const code = normalizeInviteCode(randomBytes(8).toString("base64url"));
  const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin().from("invites").insert({
    code_hash: hashInviteCode(code),
    expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    code,
    expiresAt,
    inviteUrl: `${env.appUrl}/api/auth/strava?invite=${encodeURIComponent(code)}`,
  }, { status: 201 });
}

async function readBody(request: Request): Promise<InviteRequest> {
  try {
    return (await request.json()) as InviteRequest;
  } catch {
    return {};
  }
}
