import { describe, expect, it } from "vitest";
import { buildDashboardSummary, buildExport, buildPassportEntries, filterAndSortPassportEntries } from "@/lib/domain";
import { createDemoState } from "@/lib/demo";

describe("passport domain", () => {
  it("aggregates resolved activities and excludes unresolved locations", () => {
    const state = createDemoState();
    state.activities!.push({ ...state.activities![0], id: "unresolved", countryCode: null, geographicResolutionStatus: "unresolved" });
    const entries = buildPassportEntries(state);
    const summary = buildDashboardSummary(state);

    expect(entries).toHaveLength(5);
    expect(summary.activityCount).toBe(13);
    expect(summary.unresolvedActivityCount).toBe(1);
    expect(summary.countriesVisited).toBe(5);
  });

  it("retains virtual rides without allowing them to unlock countries", () => {
    const state = createDemoState();
    state.activities!.push({
      ...state.activities![0],
      id: "virtual-canada",
      countryCode: "CA",
      sportType: "VirtualRide",
      distanceMeters: 40000,
      flags: { ...state.activities![0].flags, trainer: true },
      geographicResolutionStatus: "resolved",
    });

    const entries = buildPassportEntries(state);
    const summary = buildDashboardSummary(state);

    expect(entries.some((entry) => entry.country.code === "CA")).toBe(false);
    expect(summary.countriesVisited).toBe(5);
    expect(summary.activityCount).toBe(13);
    expect(summary.totalDistanceMeters).toBeGreaterThan(buildDashboardSummary(createDemoState()).totalDistanceMeters);
  });

  it("filters passport entries by sport and orders them by latest visit", () => {
    const entries = buildPassportEntries(createDemoState());
    const runs = filterAndSortPassportEntries(entries, "Run", "latest");
    const latest = filterAndSortPassportEntries(entries, "all", "latest");

    expect(runs.every((entry) => entry.sportTypes.includes("Run"))).toBe(true);
    expect(runs.map((entry) => entry.country.code)).toEqual(["KR", "JP", "ES", "US"]);
    expect(latest.map((entry) => entry.country.code)).toEqual(["KR", "JP", "FR", "ES", "US"]);
  });

  it("exports no provider tokens or coordinates", () => {
    const serialized = JSON.stringify(buildExport(createDemoState()));
    expect(serialized).not.toMatch(/access.?token|refresh.?token|client.?secret|latlng|polyline|coordinates/i);
  });
});
