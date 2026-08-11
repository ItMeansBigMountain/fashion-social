import { describe, expect, it } from "vitest";
import { cartIdentity, parseCartItems } from "./cart-service";
import { signVoterId } from "./vote-service";

describe("parseCartItems", () => {
  it("accepts variant IDs and bounded integer quantities", () => {
    expect(parseCartItems({ items: [{ variantId: "after-dark-blazer-xs", quantity: 2 }] })).toEqual([{ variantId: "after-dark-blazer-xs", quantity: 2 }]);
  });
  it("merges duplicate variants without exceeding the line limit", () => {
    expect(parseCartItems({ items: [{ variantId: "v1", quantity: 2 }, { variantId: "v1", quantity: 3 }] })).toEqual([{ variantId: "v1", quantity: 5 }]);
  });
  it.each([null, {}, { items: "bad" }, { items: [{ variantId: "", quantity: 1 }] }, { items: [{ variantId: "v1", quantity: 0 }] }, { items: [{ variantId: "v1", quantity: 21 }] }])("rejects malformed cart payloads", (input) => {
    expect(() => parseCartItems(input)).toThrow();
  });
});

describe("cartIdentity", () => {
  it("accepts only a correctly signed cart token", () => {
    const id = "2f4a0cb9-28a5-4e39-99c3-0d87cf888888";
    const token = signVoterId(id, "secret");
    expect(cartIdentity(token, "secret")).toEqual({ id, fresh: false });
    expect(cartIdentity(`${token}x`, "secret").fresh).toBe(true);
  });
});
