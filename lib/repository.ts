import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { normalizeStravaActivity } from "@/lib/activity-normalizer";
import { countries, countriesByCode } from "@/lib/countries";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { defaultPrivacySettings } from "@/lib/demo";
import { buildDashboardSummary, buildPassportEntries } from "@/lib/domain";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import type { ActivityPage, ActivitySummary, AppState, DashboardSummary, PassportEntry, PrivacySettings, SyncJob } from "@/lib/types";
import type { StravaActivity, StravaTokenResponse } from "@/lib/strava";

type Connection = {
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
};

type SyncJobRow = Record<string, unknown>;

const activityPageSize = 50;
const recentActivityLimit = 6;

export function hashInviteCode(code: string) {
  const normalized = normalizeInviteCode(code);
  return createHash("sha256").update(`${serverEnv().sessionSecret}:${normalized}`).digest("hex");
}

export function normalizeInviteCode(code: string) {
  return code.trim().replace(/\s+/g, "").toUpperCase();
}

export async function saveOauthConnection(tokens: StravaTokenResponse, scopes: string[], inviteCode: string) {
  const db = supabaseAdmin();
  const invite = await validateInvite(inviteCode, tokens.athlete.id);
  const displayName = [tokens.athlete.firstname, tokens.athlete.lastname].filter(Boolean).join(" ") || tokens.athlete.username || "Athlete";
  const { data: athlete, error: athleteError } = await db
    .from("athletes")
    .upsert({
      strava_athlete_id: tokens.athlete.id,
      display_name: displayName,
      avatar_url: tokens.athlete.profile ?? "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "strava_athlete_id" })
    .select("id,strava_athlete_id")
    .single();
  throwIfError(athleteError);
  if (!athlete) throw new Error("Supabase did not return the saved athlete");

  const { error: acceptError } = await db.from("invites").update({
    status: "accepted",
    accepted_athlete_id: athlete.strava_athlete_id,
    accepted_at: new Date().toISOString(),
  }).eq("id", invite.id);
  throwIfError(acceptError);

  const { error: connectionError } = await db.from("strava_connections").upsert({
    athlete_id: athlete.id,
    access_token_ciphertext: encryptSecret(tokens.access_token),
    refresh_token_ciphertext: encryptSecret(tokens.refresh_token),
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    granted_scopes: scopes,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  });
  throwIfError(connectionError);

  const settings = structuredClone(defaultPrivacySettings);
  settings.updatedAt = new Date().toISOString();
  const { error: privacyError } = await db.from("privacy_settings").upsert({
    athlete_id: athlete.id,
    settings,
    updated_at: settings.updatedAt,
  }, { onConflict: "athlete_id", ignoreDuplicates: true });
  throwIfError(privacyError);

  return { athleteId: athlete.id, stravaAthleteId: String(athlete.strava_athlete_id) };
}

export async function validateInvite(inviteCode: string, stravaAthleteId: number) {
  const codeHash = hashInviteCode(inviteCode);
  const { data, error } = await supabaseAdmin()
    .from("invites")
    .select("id,status,expires_at,accepted_athlete_id")
    .eq("code_hash", codeHash)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Invite code was not found.");
  if (data.expires_at && Date.parse(String(data.expires_at)) <= Date.now()) throw new Error("Invite code has expired.");
  if (data.status === "accepted" && Number(data.accepted_athlete_id) === stravaAthleteId) return data;
  if (data.status !== "unused") throw new Error("Invite code has already been used.");
  return data;
}

export async function getConnection(athleteId: string): Promise<Connection | null> {
  const { data, error } = await supabaseAdmin()
    .from("strava_connections")
    .select("athlete_id,access_token_ciphertext,refresh_token_ciphertext,expires_at,granted_scopes,revoked_at")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  throwIfError(error);
  if (!data || data.revoked_at) return null;
  return {
    athleteId: data.athlete_id,
    accessToken: decryptSecret(data.access_token_ciphertext),
    refreshToken: decryptSecret(data.refresh_token_ciphertext),
    expiresAt: Date.parse(data.expires_at),
    scopes: data.granted_scopes ?? [],
  };
}

export async function rotateConnectionTokens(athleteId: string, accessToken: string, refreshToken: string, expiresAt: number) {
  const { error } = await supabaseAdmin().from("strava_connections").update({
    access_token_ciphertext: encryptSecret(accessToken),
    refresh_token_ciphertext: encryptSecret(refreshToken),
    expires_at: new Date(expiresAt * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("athlete_id", athleteId).is("revoked_at", null);
  throwIfError(error);
}

export async function createSyncJob(athleteId: string) {
  const db = supabaseAdmin();
  const { data: active, error: activeError } = await db
    .from("sync_jobs")
    .select("*")
    .eq("athlete_id", athleteId)
    .in("status", ["pending", "running", "rate_limited"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(activeError);
  if (active) return mapSyncJob(active);

  const { data, error } = await db.from("sync_jobs").insert({ athlete_id: athleteId, status: "pending" }).select("*").single();
  throwIfError(error);
  if (!data) throw new Error("Supabase did not return the created sync job");
  return mapSyncJob(data);
}

export async function claimSyncJobs(limit: number) {
  const workerId = randomUUID();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin().rpc("claim_sync_jobs", {
    p_limit: limit,
    p_stale_before: staleBefore,
    p_worker_id: workerId,
  });
  throwIfError(error);
  return { workerId, jobs: ((data ?? []) as SyncJobRow[]).map(mapSyncJob) };
}

export async function getSyncJob(athleteId: string, jobId: string) {
  const { data, error } = await supabaseAdmin().from("sync_jobs").select("*").eq("id", jobId).eq("athlete_id", athleteId).maybeSingle();
  throwIfError(error);
  return data ? mapSyncJob(data) : null;
}

export async function latestSyncJob(athleteId: string) {
  const { data, error } = await supabaseAdmin().from("sync_jobs").select("*").eq("athlete_id", athleteId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  throwIfError(error);
  return data ? mapSyncJob(data) : emptySyncJob();
}

export async function markJobRunning(athleteId: string, jobId: string) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin().from("sync_jobs").update({
    status: "running",
    error: null,
    retry_after: null,
    last_heartbeat_at: now,
  }).eq("id", jobId).eq("athlete_id", athleteId);
  throwIfError(error);
}

export async function recordSyncPage(athleteId: string, jobId: string, activities: StravaActivity[], page: number) {
  const db = supabaseAdmin();
  const { data: currentJob, error: currentJobError } = await db
    .from("sync_jobs")
    .select("processed,imported,updated")
    .eq("id", jobId)
    .eq("athlete_id", athleteId)
    .single();
  throwIfError(currentJobError);
  if (!currentJob) throw new Error("Sync job not found while recording a page");
  const providerIds = activities.map((activity) => activity.id);
  const { data: existing, error: existingError } = providerIds.length
    ? await db.from("activities").select("provider_activity_id").eq("athlete_id", athleteId).in("provider_activity_id", providerIds)
    : { data: [], error: null };
  throwIfError(existingError);
  const existingIds = new Set((existing ?? []).map((row) => row.provider_activity_id));

  const rows = activities.map((activity) => {
    const normalized = normalizeStravaActivity(activity);
    return {
      athlete_id: athleteId,
      provider_activity_id: activity.id,
      name: normalized.name,
      sport_type: normalized.sportType,
      start_time: normalized.startTime,
      distance_meters: normalized.distanceMeters,
      moving_time_seconds: normalized.movingTimeSeconds,
      elapsed_time_seconds: normalized.elapsedTimeSeconds,
      elevation_gain_meters: normalized.elevationGainMeters,
      manual: normalized.flags.manual,
      commute: normalized.flags.commute,
      trainer: normalized.flags.trainer,
      country_code: normalized.countryCode,
      geographic_resolution_status: normalized.geographicResolutionStatus,
      last_seen_sync_id: jobId,
      fetched_at: new Date().toISOString(),
    };
  });

  if (rows.length) {
    const { error: upsertError } = await db.from("activities").upsert(rows, { onConflict: "athlete_id,provider_activity_id" });
    throwIfError(upsertError);
  }

  const imported = providerIds.filter((id) => !existingIds.has(id)).length;
  const updated = providerIds.length - imported;
  const now = new Date().toISOString();
  const { error: jobError } = await db.from("sync_jobs").update({
    status: "running",
    next_page: page + 1,
    processed: Number(currentJob.processed) + activities.length,
    imported: Number(currentJob.imported) + imported,
    updated: Number(currentJob.updated) + updated,
    last_heartbeat_at: now,
    last_page_processed_at: now,
  }).eq("id", jobId).eq("athlete_id", athleteId);
  throwIfError(jobError);
}

export async function completeSyncJob(athleteId: string, jobId: string) {
  const db = supabaseAdmin();
  const { error: deleteError } = await db.from("activities").delete().eq("athlete_id", athleteId).neq("last_seen_sync_id", jobId);
  throwIfError(deleteError);
  await refreshDerivedActivityData(athleteId);
  const completedAt = new Date().toISOString();
  const { error } = await db.from("sync_jobs").update({
    status: "completed",
    completed_at: completedAt,
    error: null,
    retry_after: null,
    locked_at: null,
    locked_by: null,
  }).eq("id", jobId).eq("athlete_id", athleteId);
  throwIfError(error);
}

export async function pauseSyncJob(athleteId: string, jobId: string, retryAfterSeconds: number) {
  const retryAfter = new Date(Date.now() + retryAfterSeconds * 1000).toISOString();
  const { error } = await supabaseAdmin().from("sync_jobs").update({
    status: "rate_limited",
    retry_after: retryAfter,
    error: "Strava rate limit reached",
    locked_at: null,
    locked_by: null,
  }).eq("id", jobId).eq("athlete_id", athleteId);
  throwIfError(error);
}

export async function failSyncJob(athleteId: string, jobId: string, message: string) {
  const { error } = await supabaseAdmin().from("sync_jobs").update({
    status: "failed",
    error: message,
    failed: 1,
    locked_at: null,
    locked_by: null,
  }).eq("id", jobId).eq("athlete_id", athleteId);
  throwIfError(error);
}

export async function getProviderRateLimit(provider = "strava") {
  const { data, error } = await supabaseAdmin().from("provider_rate_limits").select("retry_after").eq("provider", provider).maybeSingle();
  throwIfError(error);
  if (!data?.retry_after) return null;
  const retryAfter = Date.parse(data.retry_after);
  return retryAfter > Date.now() ? retryAfter : null;
}

export async function setProviderRateLimit(retryAfterSeconds: number, provider = "strava") {
  const retryAfter = new Date(Date.now() + retryAfterSeconds * 1000).toISOString();
  const { error } = await supabaseAdmin().from("provider_rate_limits").upsert({
    provider,
    retry_after: retryAfter,
    updated_at: new Date().toISOString(),
  });
  throwIfError(error);
}

export async function loadAppState(athleteId: string): Promise<AppState> {
  const db = supabaseAdmin();
  const [{ data: athlete, error: athleteError }, { data: connection, error: connectionError }, { data: privacy, error: privacyError }, recentActivities, passportEntries, dashboardSummary, syncJob] = await Promise.all([
    db.from("athletes").select("id,display_name,avatar_url,created_at").eq("id", athleteId).single(),
    db.from("strava_connections").select("athlete_id,revoked_at").eq("athlete_id", athleteId).maybeSingle(),
    db.from("privacy_settings").select("settings").eq("athlete_id", athleteId).maybeSingle(),
    readRecentActivities(athleteId),
    readPassportEntries(athleteId),
    readDashboardSummary(athleteId),
    latestSyncJob(athleteId),
  ]);
  throwIfError(athleteError); throwIfError(connectionError); throwIfError(privacyError);
  if (!athlete) throw new Error("Athlete not found");

  return {
    mode: "live",
    authenticated: true,
    user: {
      displayName: athlete.display_name,
      avatarUrl: athlete.avatar_url ?? "",
      provider: "strava",
      providerStatus: connection && !connection.revoked_at ? "Connected" : "Disconnected",
      createdAt: athlete.created_at,
    },
    recentActivities,
    passportEntries,
    dashboardSummary: { ...dashboardSummary, recentActivities, recentCountries: dashboardSummary.recentCountries },
    countries,
    privacySettings: sanitizePrivacySettings(privacy?.settings),
    syncJob,
    providerConnected: Boolean(connection && !connection.revoked_at),
  };
}

export async function loadExportState(athleteId: string): Promise<AppState> {
  const state = await loadAppState(athleteId);
  const activities = await readAllActivities(athleteId);
  const passportEntries = buildPassportEntries({ activities, countries });
  return {
    ...state,
    activities,
    recentActivities: activities.slice(0, recentActivityLimit),
    passportEntries,
    dashboardSummary: buildDashboardSummary({ activities, countries, passportEntries }),
  };
}

export async function listActivitiesPage(athleteId: string, cursor: string | null, limit = activityPageSize): Promise<ActivityPage> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || activityPageSize, 1), 100);
  let query = supabaseAdmin()
    .from("activities")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("start_time", { ascending: false })
    .order("provider_activity_id", { ascending: false })
    .limit(safeLimit + 1);

  const decoded = decodeActivityCursor(cursor);
  if (decoded) {
    query = query.or(`start_time.lt.${decoded.startTime},and(start_time.eq.${decoded.startTime},provider_activity_id.lt.${decoded.providerActivityId})`);
  }

  const { data, error } = await query;
  throwIfError(error);
  const rows = data ?? [];
  const items = rows.slice(0, safeLimit).map(mapActivity);
  const last = rows.length > safeLimit ? rows[safeLimit - 1] : null;
  return { items, nextCursor: last ? encodeActivityCursor(String(last.start_time), Number(last.provider_activity_id)) : null };
}

export async function savePrivacySettings(athleteId: string, settings: PrivacySettings) {
  const safe = sanitizePrivacySettings(settings);
  safe.updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin().from("privacy_settings").upsert({ athlete_id: athleteId, settings: safe, updated_at: safe.updatedAt });
  throwIfError(error);
  return safe;
}

export async function removeConnection(athleteId: string) {
  const { error } = await supabaseAdmin().from("strava_connections").delete().eq("athlete_id", athleteId);
  throwIfError(error);
}

export async function deleteAthlete(athleteId: string) {
  const { error } = await supabaseAdmin().from("athletes").delete().eq("id", athleteId);
  throwIfError(error);
}

async function refreshDerivedActivityData(athleteId: string) {
  const activities = await readAllActivities(athleteId);
  const passportEntries = buildPassportEntries({ activities, countries });
  const dashboardSummary = buildDashboardSummary({ activities, countries, passportEntries });
  const db = supabaseAdmin();
  const { error: deleteError } = await db.from("passport_country_summaries").delete().eq("athlete_id", athleteId);
  throwIfError(deleteError);
  if (passportEntries.length) {
    const { error: summaryError } = await db.from("passport_country_summaries").insert(passportEntries.map((entry) => ({
      athlete_id: athleteId,
      country_code: entry.country.code,
      first_visited_at: entry.firstVisitedAt,
      last_visited_at: entry.lastVisitedAt,
      activity_count: entry.activityCount,
      total_distance_meters: entry.totalDistanceMeters,
      total_moving_time_seconds: entry.totalMovingTimeSeconds,
      total_elevation_gain_meters: entry.totalElevationGainMeters,
      sport_types: entry.sportTypes,
      stamp_variant: entry.stamp.variant,
      updated_at: new Date().toISOString(),
    })));
    throwIfError(summaryError);
  }
  const { error: totalsError } = await db.from("athlete_activity_totals").upsert({
    athlete_id: athleteId,
    activity_count: dashboardSummary.activityCount,
    unresolved_activity_count: dashboardSummary.unresolvedActivityCount,
    total_distance_meters: dashboardSummary.totalDistanceMeters,
    total_moving_time_seconds: dashboardSummary.totalMovingTimeSeconds,
    total_elevation_gain_meters: dashboardSummary.totalElevationGainMeters,
    updated_at: new Date().toISOString(),
  });
  throwIfError(totalsError);
}

async function readDashboardSummary(athleteId: string): Promise<DashboardSummary> {
  const [passportEntries, recentActivities, { data: totals, error: totalsError }] = await Promise.all([
    readPassportEntries(athleteId),
    readRecentActivities(athleteId),
    supabaseAdmin().from("athlete_activity_totals").select("*").eq("athlete_id", athleteId).maybeSingle(),
  ]);
  throwIfError(totalsError);
  return {
    passportEntries,
    countriesVisited: passportEntries.length,
    continentsVisited: new Set(passportEntries.map((entry) => entry.country.continent)).size,
    activityCount: Number(totals?.activity_count ?? 0),
    unresolvedActivityCount: Number(totals?.unresolved_activity_count ?? 0),
    totalDistanceMeters: Number(totals?.total_distance_meters ?? 0),
    totalMovingTimeSeconds: Number(totals?.total_moving_time_seconds ?? 0),
    totalElevationGainMeters: Number(totals?.total_elevation_gain_meters ?? 0),
    recentCountries: [...passportEntries].sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt)).slice(0, 4),
    recentActivities,
  };
}

async function readPassportEntries(athleteId: string): Promise<PassportEntry[]> {
  const { data, error } = await supabaseAdmin()
    .from("passport_country_summaries")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("country_code", { ascending: true });
  throwIfError(error);
  return (data ?? []).map((row) => {
    const countryCode = String(row.country_code).trim();
    const country = countriesByCode.get(countryCode);
    if (!country) return null;
    return {
      country,
      firstVisitedAt: String(row.first_visited_at),
      lastVisitedAt: String(row.last_visited_at),
      activityCount: Number(row.activity_count),
      totalDistanceMeters: Number(row.total_distance_meters),
      totalMovingTimeSeconds: Number(row.total_moving_time_seconds),
      totalElevationGainMeters: Number(row.total_elevation_gain_meters),
      sportTypes: Array.isArray(row.sport_types) ? row.sport_types.map(String).sort() : [],
      stamp: { variant: String(row.stamp_variant) },
    } satisfies PassportEntry;
  }).filter((entry): entry is PassportEntry => Boolean(entry));
}

async function readRecentActivities(athleteId: string) {
  const { items } = await listActivitiesPage(athleteId, null, recentActivityLimit);
  return items;
}

async function readAllActivities(athleteId: string) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin().from("activities").select("*").eq("athlete_id", athleteId).order("start_time", { ascending: false }).range(from, from + pageSize - 1);
    throwIfError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(mapActivity);
}

function encodeActivityCursor(startTime: string, providerActivityId: number) {
  return Buffer.from(JSON.stringify({ startTime, providerActivityId })).toString("base64url");
}

function decodeActivityCursor(cursor: string | null) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { startTime?: unknown; providerActivityId?: unknown };
    if (typeof value.startTime !== "string" || !Number.isFinite(Number(value.providerActivityId))) return null;
    return { startTime: value.startTime, providerActivityId: Number(value.providerActivityId) };
  } catch {
    return null;
  }
}

function mapActivity(row: Record<string, unknown>): ActivitySummary {
  return {
    id: String(row.provider_activity_id),
    provider: "strava",
    countryCode: row.country_code ? String(row.country_code).trim() : null,
    sportType: String(row.sport_type),
    name: String(row.name),
    startTime: String(row.start_time),
    distanceMeters: Number(row.distance_meters),
    movingTimeSeconds: Number(row.moving_time_seconds),
    elapsedTimeSeconds: Number(row.elapsed_time_seconds),
    elevationGainMeters: Number(row.elevation_gain_meters),
    flags: { manual: Boolean(row.manual), commute: Boolean(row.commute), trainer: Boolean(row.trainer) },
    geographicResolutionStatus: row.geographic_resolution_status === "resolved" ? "resolved" : "unresolved",
  };
}

function mapSyncJob(row: Record<string, unknown>): SyncJob {
  const retryAfter = row.retry_after ? Date.parse(String(row.retry_after)) : null;
  return {
    id: String(row.id),
    athleteId: row.athlete_id ? String(row.athlete_id) : undefined,
    status: row.status as SyncJob["status"],
    page: Number(row.next_page),
    processed: Number(row.processed),
    imported: Number(row.imported),
    updated: Number(row.updated),
    failed: Number(row.failed),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    error: row.error ? String(row.error) : null,
    retryAfterSeconds: retryAfter ? Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000)) : null,
  };
}

function emptySyncJob(): SyncJob {
  return { id: "none", status: "idle", page: 1, processed: 0, imported: 0, updated: 0, failed: 0, completedAt: null, error: null, retryAfterSeconds: null };
}

function sanitizePrivacySettings(value: unknown): PrivacySettings {
  const input = (value && typeof value === "object" ? value : {}) as Partial<PrivacySettings>;
  const visibility = (input.visibility && typeof input.visibility === "object" ? input.visibility : {}) as Partial<PrivacySettings["visibility"]>;
  return {
    ...structuredClone(defaultPrivacySettings),
    ...input,
    publicPassportEnabled: false,
    publicUrl: null,
    discoverableWithinApp: false,
    allowSearchEngineIndexing: false,
    visibility: { ...defaultPrivacySettings.visibility, ...visibility, publicMap: false },
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
