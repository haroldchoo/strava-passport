import { NextResponse } from "next/server";
import { deleteAthlete, getConnection } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";
import { clearSession } from "@/lib/session";
import { revokeToken } from "@/lib/strava";

export async function DELETE() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const connection = await getConnection(auth.session.athleteId);
  if (connection) await revokeToken(connection.refreshToken);
  await deleteAthlete(auth.session.athleteId);
  await clearSession();
  return NextResponse.json({ ok: true });
}
