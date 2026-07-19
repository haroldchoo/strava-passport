import { NextResponse } from "next/server";
import { getSyncJob } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const { jobId } = await context.params;
  const job = await getSyncJob(auth.session.athleteId, jobId);
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Sync job not found" }, { status: 404 });
}
