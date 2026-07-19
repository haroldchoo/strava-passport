import { NextResponse } from "next/server";
import {
  completeSyncJob,
  failSyncJob,
  getConnection,
  getSyncJob,
  markJobRunning,
  pauseSyncJob,
  recordSyncPage,
  rotateConnectionTokens,
} from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";
import { listAthleteActivities, refreshAccessToken, StravaApiError } from "@/lib/strava";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const { jobId } = await context.params;
  const athleteId = auth.session.athleteId;
  let job = await getSyncJob(athleteId, jobId);
  if (!job) return NextResponse.json({ error: "Sync job not found" }, { status: 404 });
  if (job.status === "completed" || job.status === "failed") return NextResponse.json(job);
  if (job.status === "rate_limited" && (job.retryAfterSeconds ?? 0) > 0) return NextResponse.json(job);

  try {
    const connection = await getConnection(athleteId);
    if (!connection) return NextResponse.json({ error: "Strava is disconnected" }, { status: 409 });
    await markJobRunning(athleteId, jobId);

    let accessToken = connection.accessToken;
    if (connection.expiresAt <= Date.now() + 60 * 60 * 1000) {
      const refreshed = await refreshAccessToken(connection.refreshToken);
      accessToken = refreshed.access_token;
      await rotateConnectionTokens(athleteId, refreshed.access_token, refreshed.refresh_token, refreshed.expires_at);
    }

    const activities = await listAthleteActivities(accessToken, job.page, 200);
    await recordSyncPage(athleteId, jobId, activities, job.page);
    if (activities.length < 200) await completeSyncJob(athleteId, jobId);
    job = (await getSyncJob(athleteId, jobId))!;
    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof StravaApiError && error.status === 429) {
      await pauseSyncJob(athleteId, jobId, error.retryAfterSeconds ?? 15 * 60);
      return NextResponse.json(await getSyncJob(athleteId, jobId));
    }
    const message = error instanceof Error ? error.message : "Synchronization failed";
    await failSyncJob(athleteId, jobId, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
