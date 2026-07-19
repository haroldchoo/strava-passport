import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizationUrl, refreshAccessToken, revokeToken } from "@/lib/strava";

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://passport.example";
  process.env.STRAVA_CLIENT_ID = "12345";
  process.env.STRAVA_CLIENT_SECRET = "private-client-secret";
  process.env.STRAVA_ALLOWED_ATHLETE_ID = "67890";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  vi.restoreAllMocks();
});

describe("Strava provider adapter", () => {
  it("builds the allow-listed private-activity OAuth request", () => {
    const url = authorizationUrl("csrf-state");
    expect(url.origin + url.pathname).toBe("https://www.strava.com/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe("https://passport.example/api/auth/strava/callback");
    expect(url.searchParams.get("scope")).toBe("read,activity:read_all");
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });

  it("refreshes at the canonical OAuth endpoint and rotates the returned token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_at: 2_000_000_000,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const refreshed = await refreshAccessToken("old-refresh");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.strava.com/oauth/token");
    expect(String(options?.body)).toContain("grant_type=refresh_token");
    expect(String(options?.body)).toContain("refresh_token=old-refresh");
    expect(refreshed.refresh_token).toBe("new-refresh");
  });

  it("revokes with server-side basic authentication", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    await revokeToken("refresh-token");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.strava.com/oauth/revoke");
    expect(new Headers(options?.headers).get("authorization")).toMatch(/^Basic /);
    expect(String(options?.body)).toContain("token=refresh-token");
  });
});
