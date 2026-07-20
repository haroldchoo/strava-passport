import { describe, expect, it } from "vitest";
import { hashInviteCode, normalizeInviteCode } from "@/lib/repository";

process.env.STRAVA_CLIENT_ID ??= "client";
process.env.STRAVA_CLIENT_SECRET ??= "secret";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role";
process.env.SESSION_SECRET ??= "x".repeat(32);
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString("base64");
process.env.SYNC_WORKER_SECRET ??= "worker-secret";

describe("invite codes", () => {
  it("normalizes codes before hashing", () => {
    expect(normalizeInviteCode(" abcd 1234 ")).toBe("ABCD1234");
    expect(hashInviteCode(" abcd 1234 ")).toBe(hashInviteCode("ABCD1234"));
  });
});
