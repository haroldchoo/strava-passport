import type { ActivitySummary, AppState, DashboardSummary, PassportEntry } from "@/lib/types";

export function buildPassportEntries(state: Pick<AppState, "activities" | "countries">): PassportEntry[] {
  const countriesByCode = new Map(state.countries.map((country) => [country.code, country]));
  const grouped = new Map<string, ActivitySummary[]>();

  for (const activity of state.activities) {
    if (!isPassportEligibleActivity(activity)) continue;
    const group = grouped.get(activity.countryCode) ?? [];
    group.push(activity);
    grouped.set(activity.countryCode, group);
  }

  return [...grouped.entries()]
    .map(([countryCode, activities]) => {
      const country = countriesByCode.get(countryCode);
      if (!country) return null;
      const sorted = [...activities].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
      return {
        country,
        firstVisitedAt: sorted[0].startTime,
        lastVisitedAt: sorted.at(-1)!.startTime,
        activityCount: sorted.length,
        totalDistanceMeters: sum(sorted, "distanceMeters"),
        totalMovingTimeSeconds: sum(sorted, "movingTimeSeconds"),
        totalElevationGainMeters: sum(sorted, "elevationGainMeters"),
        sportTypes: [...new Set(sorted.map((item) => item.sportType))].sort(),
        stamp: { variant: `classic-${(countryCode.charCodeAt(0) + countryCode.charCodeAt(1)) % 4}` },
      } satisfies PassportEntry;
    })
    .filter((entry): entry is PassportEntry => Boolean(entry))
    .sort((a, b) => a.country.name.localeCompare(b.country.name));
}

export function buildDashboardSummary(state: AppState): DashboardSummary {
  const passportEntries = buildPassportEntries(state);
  return {
    passportEntries,
    countriesVisited: passportEntries.length,
    continentsVisited: new Set(passportEntries.map((entry) => entry.country.continent)).size,
    activityCount: state.activities.length,
    unresolvedActivityCount: state.activities.filter((activity) => activity.geographicResolutionStatus === "unresolved").length,
    totalDistanceMeters: sum(state.activities, "distanceMeters"),
    totalMovingTimeSeconds: sum(state.activities, "movingTimeSeconds"),
    totalElevationGainMeters: sum(state.activities, "elevationGainMeters"),
    recentCountries: [...passportEntries].sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt)).slice(0, 4),
    recentActivities: [...state.activities].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)).slice(0, 6),
  };
}

export function buildExport(state: AppState) {
  return {
    profile: {
      displayName: state.user.displayName,
      providerStatus: state.providerConnected ? state.user.providerStatus : "Disconnected",
      createdAt: state.user.createdAt,
    },
    passport: buildPassportEntries(state),
    activitySummaries: state.activities,
    privacySettings: state.privacySettings,
    connectionMetadata: {
      provider: "strava",
      connected: state.providerConnected,
      lastSyncStatus: state.syncJob.status,
    },
  };
}

export function formatDistance(meters: number) {
  return `${Math.round(meters / 100) / 10} km`;
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

export function sportLabel(sportType: string) {
  const normalized = sportType.replace(/([a-z])([A-Z])/g, "$1 $2");
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isPassportEligibleActivity(activity: ActivitySummary): activity is ActivitySummary & { countryCode: string } {
  if (activity.geographicResolutionStatus !== "resolved" || !activity.countryCode) return false;
  const sportType = activity.sportType.replace(/[\s_-]/g, "").toLowerCase();
  const isVirtualRide = sportType === "virtualride" || (activity.flags.trainer && sportType.endsWith("ride"));
  return !isVirtualRide;
}

function sum<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}
