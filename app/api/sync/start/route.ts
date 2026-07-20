import { NextResponse } from "next/server";
import { createSyncJob, getConnection, getSyncJob } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";
import { runSyncJobNow } from "@/lib/sync-worker";

export async function POST() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const connection = await getConnection(auth.session.athleteId);
  if (!connection) return NextResponse.json({ error: "Strava is disconnected" }, { status: 409 });
  const job = await createSyncJob(auth.session.athleteId);
  if (job.status === "pending" || job.status === "running" || (job.status === "rate_limited" && job.retryAfterSeconds === 0)) {
    await runSyncJobNow(job);
  }
  const latest = await getSyncJob(auth.session.athleteId, job.id);
  return latest ? NextResponse.json(latest, { status: 201 }) : NextResponse.json({ error: "Sync job not found" }, { status: 404 });
}
