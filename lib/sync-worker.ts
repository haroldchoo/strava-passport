import "server-only";
import {
  claimSyncJobs,
  completeSyncJob,
  failSyncJob,
  getConnection,
  getProviderRateLimit,
  getSyncJob,
  markJobRunning,
  pauseSyncJob,
  recordSyncPage,
  rotateConnectionTokens,
  setProviderRateLimit,
} from "@/lib/repository";
import { serverEnv } from "@/lib/env";
import { listAthleteActivities, refreshAccessToken, StravaApiError } from "@/lib/strava";
import type { SyncJob } from "@/lib/types";

type WorkerResult = {
  claimed: number;
  processedPages: number;
  completed: number;
  paused: number;
  failed: number;
};

export async function runSyncWorker() {
  const env = serverEnv();
  const result: WorkerResult = { claimed: 0, processedPages: 0, completed: 0, paused: 0, failed: 0 };
  const rateLimitedUntil = await getProviderRateLimit();
  if (rateLimitedUntil) return { ...result, rateLimitedUntil };

  const { jobs } = await claimSyncJobs(env.syncBatchSize);
  result.claimed = jobs.length;
  let remainingPages = env.syncMaxPagesPerRun;

  for (const claimed of jobs) {
    let job: SyncJob | null = claimed;
    while (job && remainingPages > 0 && (job.status === "pending" || job.status === "running" || (job.status === "rate_limited" && job.retryAfterSeconds === 0))) {
      const pageResult = await processSyncPage(job);
      result.processedPages += pageResult.processedPage ? 1 : 0;
      remainingPages -= pageResult.processedPage ? 1 : 0;
      if (pageResult.completed) result.completed += 1;
      if (pageResult.paused) result.paused += 1;
      if (pageResult.failed) result.failed += 1;
      if (pageResult.stopAll) return result;
      job = pageResult.nextJob;
      if (pageResult.completed || pageResult.paused || pageResult.failed) break;
    }
    if (remainingPages <= 0) break;
  }

  return result;
}

export async function runSyncJobNow(job: SyncJob, maxPages = 5) {
  const result: WorkerResult = { claimed: 1, processedPages: 0, completed: 0, paused: 0, failed: 0 };
  const rateLimitedUntil = await getProviderRateLimit();
  if (rateLimitedUntil) return { ...result, rateLimitedUntil };

  let current: SyncJob | null = job;
  let remainingPages = Math.max(1, maxPages);
  while (current && remainingPages > 0 && (current.status === "pending" || current.status === "running" || (current.status === "rate_limited" && current.retryAfterSeconds === 0))) {
    const pageResult = await processSyncPage(current);
    result.processedPages += pageResult.processedPage ? 1 : 0;
    remainingPages -= pageResult.processedPage ? 1 : 0;
    if (pageResult.completed) result.completed += 1;
    if (pageResult.paused) result.paused += 1;
    if (pageResult.failed) result.failed += 1;
    if (pageResult.stopAll || pageResult.completed || pageResult.paused || pageResult.failed) break;
    current = pageResult.nextJob;
  }

  return result;
}

export async function processSyncPage(job: SyncJob) {
  const athleteId = await athleteIdForJob(job);
  try {
    const connection = await getConnection(athleteId);
    if (!connection) {
      await failSyncJob(athleteId, job.id, "Strava is disconnected");
      return { nextJob: null, processedPage: false, failed: true };
    }
    await markJobRunning(athleteId, job.id);

    let accessToken = connection.accessToken;
    if (connection.expiresAt <= Date.now() + 60 * 60 * 1000) {
      const refreshed = await refreshAccessToken(connection.refreshToken);
      accessToken = refreshed.access_token;
      await rotateConnectionTokens(athleteId, refreshed.access_token, refreshed.refresh_token, refreshed.expires_at);
    }

    const activities = await listAthleteActivities(accessToken, job.page, 200);
    await recordSyncPage(athleteId, job.id, activities, job.page);
    if (activities.length < 200) {
      await completeSyncJob(athleteId, job.id);
      return { nextJob: await getSyncJob(athleteId, job.id), processedPage: true, completed: true };
    }
    return { nextJob: await getSyncJob(athleteId, job.id), processedPage: true };
  } catch (error) {
    if (error instanceof StravaApiError && error.status === 429) {
      const retryAfter = error.retryAfterSeconds ?? 15 * 60;
      await Promise.all([pauseSyncJob(athleteId, job.id, retryAfter), setProviderRateLimit(retryAfter)]);
      return { nextJob: await getSyncJob(athleteId, job.id), processedPage: false, paused: true, stopAll: true };
    }
    const message = error instanceof Error ? error.message : "Synchronization failed";
    await failSyncJob(athleteId, job.id, message);
    return { nextJob: null, processedPage: false, failed: true };
  }
}

async function athleteIdForJob(job: SyncJob) {
  const row = job as SyncJob & { athleteId?: string };
  if (row.athleteId) return row.athleteId;
  throw new Error("Claimed sync job did not include athleteId");
}
