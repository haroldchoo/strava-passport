import { describe, expect, it } from "vitest";
import { normalizeStravaActivity } from "@/lib/activity-normalizer";

describe("Strava activity normalization", () => {
  it("keeps summary fields while discarding source coordinates", () => {
    const normalized = normalizeStravaActivity({
      id: 123,
      name: "Seoul Morning Run",
      sport_type: "Run",
      start_date: "2026-07-19T00:00:00Z",
      distance: 10000,
      moving_time: 3000,
      elapsed_time: 3200,
      total_elevation_gain: 80,
      start_latlng: [37.5665, 126.978],
      commute: false,
      manual: false,
      trainer: false,
    });

    expect(normalized.countryCode).toBe("KR");
    expect(normalized.geographicResolutionStatus).toBe("resolved");
    expect(normalized).not.toHaveProperty("start_latlng");
    expect(normalized).not.toHaveProperty("coordinates");
  });

  it("retains coordinate-free activities as unresolved", () => {
    const normalized = normalizeStravaActivity({ id: 456, name: "Pool Swim", sport_type: "Swim", start_date: "2026-07-18T00:00:00Z" });
    expect(normalized.countryCode).toBeNull();
    expect(normalized.geographicResolutionStatus).toBe("unresolved");
  });
});
