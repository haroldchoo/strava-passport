import { NextResponse } from "next/server";
import { createSyncJob, getConnection } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";

export async function POST() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const connection = await getConnection(auth.session.athleteId);
  if (!connection) return NextResponse.json({ error: "Strava is disconnected" }, { status: 409 });
  return NextResponse.json(await createSyncJob(auth.session.athleteId), { status: 201 });
}
