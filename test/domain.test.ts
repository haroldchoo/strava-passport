import { describe, expect, it } from "vitest";
import { buildDashboardSummary, buildExport, buildPassportEntries } from "@/lib/domain";
import { createDemoState } from "@/lib/demo";

describe("passport domain", () => {
  it("aggregates resolved activities and excludes unresolved locations", () => {
    const state = createDemoState();
    state.activities.push({ ...state.activities[0], id: "unresolved", countryCode: null, geographicResolutionStatus: "unresolved" });
    const entries = buildPassportEntries(state);
    const summary = buildDashboardSummary(state);

    expect(entries).toHaveLength(5);
    expect(summary.activityCount).toBe(13);
    expect(summary.unresolvedActivityCount).toBe(1);
    expect(summary.countriesVisited).toBe(5);
  });

  it("exports no provider tokens or coordinates", () => {
    const serialized = JSON.stringify(buildExport(createDemoState()));
    expect(serialized).not.toMatch(/access.?token|refresh.?token|client.?secret|latlng|polyline|coordinates/i);
  });
});
