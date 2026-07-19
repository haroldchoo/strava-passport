import { countries } from "@/lib/countries";
import type { ActivitySummary, AppState, PrivacySettings } from "@/lib/types";

const demoTimestamp = "2026-07-19T00:00:00.000Z";

export const defaultPrivacySettings: PrivacySettings = {
  publicPassportEnabled: false,
  publicUrl: null,
  visibility: {
    displayName: false,
    avatar: false,
    countries: true,
    continents: true,
    activityCount: false,
    totalDistance: false,
    totalMovingTime: false,
    visitDates: false,
    sportTypes: false,
    stamps: true,
    publicMap: false,
  },
  discoverableWithinApp: false,
  allowSearchEngineIndexing: false,
  updatedAt: demoTimestamp,
};

function activity(
  id: string,
  countryCode: string,
  sportType: string,
  name: string,
  startTime: string,
  distanceMeters: number,
  movingTimeSeconds: number,
  elevationGainMeters: number,
): ActivitySummary {
  return {
    id,
    provider: "strava",
    countryCode,
    sportType,
    name,
    startTime,
    distanceMeters,
    movingTimeSeconds,
    elapsedTimeSeconds: Math.round(movingTimeSeconds * 1.08),
    elevationGainMeters,
    flags: { manual: false, commute: false, trainer: false },
    geographicResolutionStatus: "resolved",
  };
}

const demoActivities = [
  activity("act_001", "KR", "Run", "Han River Tempo", "2026-07-18T22:10:00.000Z", 12300, 3260, 70),
  activity("act_002", "KR", "Ride", "Namsan Loops", "2026-07-12T23:40:00.000Z", 54200, 6810, 810),
  activity("act_003", "JP", "Run", "Tokyo Bay Shakeout", "2026-06-02T22:00:00.000Z", 9600, 2820, 42),
  activity("act_004", "JP", "Triathlon", "Yokohama Tri Weekend", "2026-05-31T00:30:00.000Z", 51500, 7900, 220),
  activity("act_005", "FR", "Ride", "Annecy Lake Ride", "2025-09-14T07:00:00.000Z", 82100, 10420, 980),
  activity("act_006", "FR", "Hike", "Chamonix Ridge Hike", "2025-09-10T08:10:00.000Z", 14200, 16200, 1320),
  activity("act_007", "ES", "Run", "Barcelona Long Run", "2025-03-09T06:30:00.000Z", 24800, 7390, 120),
  activity("act_008", "ES", "Swim", "Mediterranean Open Water", "2025-03-07T08:00:00.000Z", 2100, 2480, 0),
  activity("act_009", "US", "Run", "Golden Gate Morning", "2024-11-28T15:20:00.000Z", 16100, 5120, 310),
  activity("act_010", "US", "Ride", "Marin Headlands", "2024-11-26T16:00:00.000Z", 67200, 9100, 1240),
  activity("act_011", "KR", "Swim", "Jamsil Pool Endurance", "2024-07-02T10:30:00.000Z", 3200, 3700, 0),
  activity("act_012", "KR", "Hike", "Bukhansan Summit", "2024-02-01T01:00:00.000Z", 9800, 14500, 780),
];

export function createDemoState(): AppState {
  return {
    mode: "demo",
    authenticated: false,
    user: {
      displayName: "Harold",
      avatarUrl: "",
      provider: "strava",
      providerStatus: "Demo mode",
      createdAt: "2026-07-19T00:00:00.000Z",
    },
    activities: structuredClone(demoActivities),
    countries,
    privacySettings: structuredClone(defaultPrivacySettings),
    syncJob: {
      id: "sync_demo",
      status: "completed",
      page: 1,
      processed: demoActivities.length,
      imported: demoActivities.length,
      updated: 0,
      failed: 0,
      completedAt: demoTimestamp,
      error: null,
      retryAfterSeconds: null,
    },
    providerConnected: false,
  };
}
