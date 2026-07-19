import { NextResponse } from "next/server";
import { getConnection, removeConnection } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";
import { revokeToken } from "@/lib/strava";

export async function POST() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const connection = await getConnection(auth.session.athleteId);
  if (connection) await revokeToken(connection.refreshToken);
  await removeConnection(auth.session.athleteId);
  return NextResponse.json({ ok: true });
}
