import type { StravaActivity } from "@/lib/strava";
import type { ActivitySummary } from "@/lib/types";
import { resolveCountryCode } from "@/lib/country-resolver";

export function normalizeStravaActivity(activity: StravaActivity): ActivitySummary {
  const countryCode = resolveCountryCode(activity.start_latlng);
  return {
    id: String(activity.id),
    provider: "strava",
    countryCode,
    sportType: activity.sport_type || activity.type || "Other",
    name: activity.name || "Untitled activity",
    startTime: activity.start_date,
    distanceMeters: activity.distance ?? 0,
    movingTimeSeconds: activity.moving_time ?? 0,
    elapsedTimeSeconds: activity.elapsed_time ?? 0,
    elevationGainMeters: activity.total_elevation_gain ?? 0,
    flags: {
      manual: activity.manual ?? false,
      commute: activity.commute ?? false,
      trainer: activity.trainer ?? false,
    },
    geographicResolutionStatus: countryCode ? "resolved" : "unresolved",
  };
}
