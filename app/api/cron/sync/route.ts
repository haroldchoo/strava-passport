import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { runSyncWorker } from "@/lib/sync-worker";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return runAuthorizedWorker(request);
}

export async function GET(request: Request) {
  return runAuthorizedWorker(request);
}

async function runAuthorizedWorker(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const env = serverEnv();
  const cronSecret = process.env.CRON_SECRET;
  if (!env.syncWorkerSecret && !cronSecret) return NextResponse.json({ error: "Worker secret is not configured" }, { status: 500 });
  if (token !== env.syncWorkerSecret && (!cronSecret || token !== cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSyncWorker());
}
