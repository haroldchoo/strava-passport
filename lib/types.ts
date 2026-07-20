export type SyncStatus = "idle" | "pending" | "running" | "rate_limited" | "completed" | "failed";

export type ActivitySummary = {
  id: string;
  provider: "strava";
  countryCode: string | null;
  sportType: string;
  name: string;
  startTime: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  flags: { manual: boolean; commute: boolean; trainer: boolean };
  geographicResolutionStatus: "resolved" | "unresolved";
};

export type Country = {
  code: string;
  name: string;
  continent: string;
  flag: string;
  x: number;
  y: number;
};

export type PrivacySettings = {
  publicPassportEnabled: false;
  publicUrl: null;
  visibility: {
    displayName: boolean;
    avatar: boolean;
    countries: boolean;
    continents: boolean;
    activityCount: boolean;
    totalDistance: boolean;
    totalMovingTime: boolean;
    visitDates: boolean;
    sportTypes: boolean;
    stamps: boolean;
    publicMap: boolean;
  };
  discoverableWithinApp: false;
  allowSearchEngineIndexing: false;
  updatedAt: string;
};

export type SyncJob = {
  id: string;
  athleteId?: string;
  status: SyncStatus;
  page: number;
  processed: number;
  imported: number;
  updated: number;
  failed: number;
  completedAt: string | null;
  error: string | null;
  retryAfterSeconds: number | null;
};

export type AppState = {
  mode: "demo" | "live";
  authenticated: boolean;
  user: {
    displayName: string;
    avatarUrl: string;
    provider: "strava";
    providerStatus: string;
    createdAt: string;
  };
  activities?: ActivitySummary[];
  recentActivities: ActivitySummary[];
  passportEntries: PassportEntry[];
  dashboardSummary: DashboardSummary;
  countries: Country[];
  privacySettings: PrivacySettings;
  syncJob: SyncJob;
  providerConnected: boolean;
};

export type ActivityPage = {
  items: ActivitySummary[];
  nextCursor: string | null;
};

export type PassportEntry = {
  country: Country;
  firstVisitedAt: string;
  lastVisitedAt: string;
  activityCount: number;
  totalDistanceMeters: number;
  totalMovingTimeSeconds: number;
  totalElevationGainMeters: number;
  sportTypes: string[];
  stamp: { variant: string };
};

export type DashboardSummary = {
  passportEntries: PassportEntry[];
  countriesVisited: number;
  continentsVisited: number;
  activityCount: number;
  unresolvedActivityCount: number;
  totalDistanceMeters: number;
  totalMovingTimeSeconds: number;
  totalElevationGainMeters: number;
  recentCountries: PassportEntry[];
  recentActivities: ActivitySummary[];
};
