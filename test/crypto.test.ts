import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.STRAVA_CLIENT_ID = "client";
  process.env.STRAVA_CLIENT_SECRET = "secret";
  process.env.STRAVA_ALLOWED_ATHLETE_ID = "123";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.SYNC_WORKER_SECRET = "worker-secret";
});

describe("provider token encryption", () => {
  it("round trips with AES-GCM and rejects tampering", async () => {
    const { decryptSecret, encryptSecret } = await import("@/lib/crypto");
    const encrypted = encryptSecret("private-refresh-token");
    expect(encrypted).not.toContain("private-refresh-token");
    expect(decryptSecret(encrypted)).toBe("private-refresh-token");

    const parts = encrypted.split(".");
    parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith("A") ? "B" : "A"}`;
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});
