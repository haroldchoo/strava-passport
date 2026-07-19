const countries = [
  { code: "US", name: "United States", continent: "NA", flag: "🇺🇸", x: 18, y: 42 },
  { code: "KR", name: "South Korea", continent: "AS", flag: "🇰🇷", x: 78, y: 43 },
  { code: "ES", name: "Spain", continent: "EU", flag: "🇪🇸", x: 46, y: 43 },
  { code: "FR", name: "France", continent: "EU", flag: "🇫🇷", x: 49, y: 38 },
  { code: "JP", name: "Japan", continent: "AS", flag: "🇯🇵", x: 83, y: 45 },
  { code: "CA", name: "Canada", continent: "NA", flag: "🇨🇦", x: 16, y: 29 },
  { code: "GB", name: "United Kingdom", continent: "EU", flag: "🇬🇧", x: 46, y: 34 },
  { code: "AU", name: "Australia", continent: "OC", flag: "🇦🇺", x: 82, y: 73 },
];

const demoUser = {
  displayName: "Harold",
  avatarUrl: "",
  homeBase: "Seoul",
  provider: "strava",
  providerStatus: "Demo mode",
  createdAt: "2026-07-19T00:00:00.000Z",
};

const demoActivities = [
  activity("act_001", "KR", "run", "Han River Tempo", "2026-07-18T22:10:00.000Z", 12300, 3260, 70),
  activity("act_002", "KR", "ride", "Namsan Loops", "2026-07-12T23:40:00.000Z", 54200, 6810, 810),
  activity("act_003", "JP", "run", "Tokyo Bay Shakeout", "2026-06-02T22:00:00.000Z", 9600, 2820, 42),
  activity("act_004", "JP", "triathlon", "Yokohama Tri Weekend", "2026-05-31T00:30:00.000Z", 51500, 7900, 220),
  activity("act_005", "FR", "ride", "Annecy Lake Ride", "2025-09-14T07:00:00.000Z", 82100, 10420, 980),
  activity("act_006", "FR", "hike", "Chamonix Ridge Hike", "2025-09-10T08:10:00.000Z", 14200, 16200, 1320),
  activity("act_007", "ES", "run", "Barcelona Long Run", "2025-03-09T06:30:00.000Z", 24800, 7390, 120),
  activity("act_008", "ES", "swim", "Mediterranean Open Water", "2025-03-07T08:00:00.000Z", 2100, 2480, 0),
  activity("act_009", "US", "run", "Golden Gate Morning", "2024-11-28T15:20:00.000Z", 16100, 5120, 310),
  activity("act_010", "US", "ride", "Marin Headlands", "2024-11-26T16:00:00.000Z", 67200, 9100, 1240),
  activity("act_011", "KR", "swim", "Jamsil Pool Endurance", "2024-07-02T10:30:00.000Z", 3200, 3700, 0),
  activity("act_012", "KR", "hike", "Bukhansan Summit", "2024-02-01T01:00:00.000Z", 9800, 14500, 780),
];

const defaultPrivacySettings = {
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
  updatedAt: new Date().toISOString(),
};

function activity(id, countryCode, sportType, name, startTime, distanceMeters, movingTimeSeconds, elevationGainMeters) {
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

function createInitialState() {
  return {
    user: demoUser,
    activities: demoActivities,
    countries,
    privacySettings: JSON.parse(JSON.stringify(defaultPrivacySettings)),
    syncJob: {
      id: "sync_demo",
      type: "manualSync",
      status: "completed",
      processed: demoActivities.length,
      imported: demoActivities.length,
      updated: 0,
      failed: 0,
      completedAt: new Date().toISOString(),
    },
    providerConnected: true,
  };
}

function buildPassportEntries(activities, countryList) {
  const countriesByCode = new Map(countryList.map((country) => [country.code, country]));
  const grouped = new Map();

  for (const item of activities) {
    if (item.geographicResolutionStatus !== "resolved") continue;
    if (!grouped.has(item.countryCode)) grouped.set(item.countryCode, []);
    grouped.get(item.countryCode).push(item);
  }

  return [...grouped.entries()]
    .map(([countryCode, countryActivities]) => {
      const sorted = [...countryActivities].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      const country = countriesByCode.get(countryCode);
      return {
        country,
        firstVisitedAt: sorted[0].startTime,
        lastVisitedAt: sorted[sorted.length - 1].startTime,
        activityCount: sorted.length,
        totalDistanceMeters: sum(sorted, "distanceMeters"),
        totalMovingTimeSeconds: sum(sorted, "movingTimeSeconds"),
        totalElevationGainMeters: sum(sorted, "elevationGainMeters"),
        sportTypes: [...new Set(sorted.map((item) => item.sportType))].sort(),
        stamp: { variant: `classic-${(countryCode.charCodeAt(0) + countryCode.charCodeAt(1)) % 4}` },
      };
    })
    .sort((a, b) => a.country.name.localeCompare(b.country.name));
}

function buildDashboardSummary(state) {
  const passportEntries = buildPassportEntries(state.activities, state.countries);
  const continentCount = new Set(passportEntries.map((entry) => entry.country.continent)).size;
  return {
    passportEntries,
    countriesVisited: passportEntries.length,
    continentsVisited: continentCount,
    activityCount: state.activities.length,
    totalDistanceMeters: sum(state.activities, "distanceMeters"),
    totalMovingTimeSeconds: sum(state.activities, "movingTimeSeconds"),
    totalElevationGainMeters: sum(state.activities, "elevationGainMeters"),
    recentCountries: [...passportEntries].sort((a, b) => new Date(b.lastVisitedAt) - new Date(a.lastVisitedAt)).slice(0, 4),
    recentActivities: [...state.activities].sort((a, b) => new Date(b.startTime) - new Date(a.startTime)).slice(0, 6),
  };
}

function buildPublicPassport(state) {
  const settings = state.privacySettings;
  if (!settings.publicPassportEnabled) return null;

  const summary = buildDashboardSummary(state);
  const visibility = settings.visibility;
  const publicProfile = {};
  const publicSummary = {};

  if (visibility.displayName) publicProfile.displayName = state.user.displayName;
  if (visibility.avatar && state.user.avatarUrl) publicProfile.avatarUrl = state.user.avatarUrl;
  if (visibility.countries) publicSummary.countriesVisited = summary.countriesVisited;
  if (visibility.continents) publicSummary.continentsVisited = summary.continentsVisited;
  if (visibility.activityCount) publicSummary.activityCount = summary.activityCount;
  if (visibility.totalDistance) publicSummary.totalDistanceMeters = summary.totalDistanceMeters;
  if (visibility.totalMovingTime) publicSummary.totalMovingTimeSeconds = summary.totalMovingTimeSeconds;

  return {
    profile: publicProfile,
    summary: publicSummary,
    countries: summary.passportEntries.map((entry) => {
      const projected = { country: entry.country };
      if (visibility.visitDates) {
        projected.firstVisitedAt = entry.firstVisitedAt;
        projected.lastVisitedAt = entry.lastVisitedAt;
      }
      if (visibility.activityCount) projected.activityCount = entry.activityCount;
      if (visibility.totalDistance) projected.totalDistanceMeters = entry.totalDistanceMeters;
      if (visibility.sportTypes) projected.sportTypes = entry.sportTypes;
      if (visibility.stamps) projected.stamp = entry.stamp;
      return projected;
    }),
    map: visibility.publicMap ? { mode: "countries", countryCodes: summary.passportEntries.map((entry) => entry.country.code) } : null,
    meta: {
      allowSearchEngineIndexing: settings.allowSearchEngineIndexing,
      updatedAt: settings.updatedAt,
    },
  };
}

function buildExport(state) {
  return {
    profile: {
      displayName: state.user.displayName,
      providerStatus: state.providerConnected ? state.user.providerStatus : "Disconnected",
      createdAt: state.user.createdAt,
    },
    passport: buildPassportEntries(state.activities, state.countries),
    activitySummaries: state.activities,
    privacySettings: state.privacySettings,
    connectionMetadata: {
      provider: "strava",
      connected: state.providerConnected,
      lastSyncStatus: state.syncJob.status,
    },
  };
}

function formatDistance(meters) {
  return `${Math.round(meters / 100) / 10} km`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

function sportLabel(sportType) {
  const labels = { ride: "Ride", run: "Run", swim: "Swim", hike: "Hike", triathlon: "Triathlon" };
  return labels[sportType] || "Other";
}

function sum(items, key) {
  return items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}
