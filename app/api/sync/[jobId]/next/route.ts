import { NextResponse } from "next/server";
import { getProviderRateLimit, getSyncJob } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";
import { processSyncPage } from "@/lib/sync-worker";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const { jobId } = await context.params;
  const athleteId = auth.session.athleteId;
  const job = await getSyncJob(athleteId, jobId);
  if (!job) return NextResponse.json({ error: "Sync job not found" }, { status: 404 });
  if (job.status === "completed" || job.status === "failed") return NextResponse.json(job);
  if (job.status === "rate_limited" && (job.retryAfterSeconds ?? 0) > 0) return NextResponse.json(job);
  const providerRetry = await getProviderRateLimit();
  if (providerRetry) return NextResponse.json(job);

  await processSyncPage(job);
  return NextResponse.json(await getSyncJob(athleteId, jobId));
}
