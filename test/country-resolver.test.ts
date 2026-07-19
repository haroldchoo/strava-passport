import { describe, expect, it } from "vitest";
import { resolveCountryCode } from "@/lib/country-resolver";

describe("country resolver", () => {
  it("resolves representative land coordinates locally", () => {
    expect(resolveCountryCode([37.5665, 126.978])).toBe("KR");
    expect(resolveCountryCode([37.7749, -122.4194])).toBe("US");
    expect(resolveCountryCode([48.8566, 2.3522])).toBe("FR");
  });

  it("leaves missing and open-ocean points unresolved", () => {
    expect(resolveCountryCode(null)).toBeNull();
    expect(resolveCountryCode([0, -140])).toBeNull();
  });
});
