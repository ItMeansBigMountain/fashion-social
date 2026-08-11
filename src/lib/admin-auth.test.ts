import { describe, expect, it } from "vitest";
import { hashAdminToken, isAdminRoleAllowed, sessionCookieOptions } from "./admin-auth";

describe("admin authentication primitives", () => {
  it("hashes tokens deterministically without retaining the raw value", () => {
    const hash = hashAdminToken("one-time-secret");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("one-time-secret");
    expect(hashAdminToken("one-time-secret")).toBe(hash);
  });
  it("enforces role capabilities", () => {
    expect(isAdminRoleAllowed("owner", "refund")).toBe(true);
    expect(isAdminRoleAllowed("catalog", "product.write")).toBe(true);
    expect(isAdminRoleAllowed("catalog", "refund")).toBe(false);
    expect(isAdminRoleAllowed("fulfillment", "shipment.write")).toBe(true);
  });
  it("grants support inbox access without catalog access", () => {
    expect(isAdminRoleAllowed("support", "support.write")).toBe(true);
    expect(isAdminRoleAllowed("support", "product.write")).toBe(false);
  });
  it("uses hardened session-cookie defaults", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  });
});
