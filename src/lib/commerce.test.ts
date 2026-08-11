import { describe, expect, it } from "vitest";
import {
  buildCartQuote,
  normalizeSocialUrl,
  transitionOrder,
  type CatalogProduct,
  type OrderStatus,
} from "./commerce";

const catalog: CatalogProduct[] = [
  {
    id: "blazer",
    slug: "after-dark-blazer",
    name: "After Dark Blazer",
    active: true,
    currency: "usd",
    variants: [
      { id: "blazer-xs", sku: "ADB-XS", label: "XS", priceCents: 14800, inventory: 2, active: true, weightGrams: 700 },
      { id: "blazer-s", sku: "ADB-S", label: "S", priceCents: 14800, inventory: 0, active: true, weightGrams: 710 },
    ],
  },
];

describe("buildCartQuote", () => {
  it("uses server prices and calculates subtotal, weight, and quantity", () => {
    const quote = buildCartQuote(catalog, [{ variantId: "blazer-xs", quantity: 2 }]);
    expect(quote).toMatchObject({ subtotalCents: 29600, totalQuantity: 2, totalWeightGrams: 1400, currency: "usd" });
    expect(quote.lines[0]).toMatchObject({ sku: "ADB-XS", unitPriceCents: 14800, lineTotalCents: 29600 });
  });

  it("rejects unavailable stock and unknown variants", () => {
    expect(() => buildCartQuote(catalog, [{ variantId: "blazer-s", quantity: 1 }])).toThrow("out of stock");
    expect(() => buildCartQuote(catalog, [{ variantId: "missing", quantity: 1 }])).toThrow("unavailable");
  });

  it("rejects invalid quantities and mixed currencies", () => {
    expect(() => buildCartQuote(catalog, [{ variantId: "blazer-xs", quantity: 0 }])).toThrow("quantity");
    const mixed = [...catalog, { ...catalog[0], id: "other", currency: "cad", variants: [{ ...catalog[0].variants[0], id: "cad-xs" }] }];
    expect(() => buildCartQuote(mixed, [{ variantId: "blazer-xs", quantity: 1 }, { variantId: "cad-xs", quantity: 1 }])).toThrow("currency");
  });
});

describe("order transitions", () => {
  it("allows the legitimate payment and fulfillment lifecycle", () => {
    let status: OrderStatus = "pending_payment";
    for (const next of ["paid", "processing", "shipped", "delivered"] as OrderStatus[]) status = transitionOrder(status, next);
    expect(status).toBe("delivered");
  });

  it("rejects skipping payment and permits refunds only after payment", () => {
    expect(() => transitionOrder("pending_payment", "shipped")).toThrow("transition");
    expect(transitionOrder("paid", "refunded")).toBe("refunded");
  });
});

describe("social URL normalization", () => {
  it.each([
    ["https://www.instagram.com/p/ABC123/?utm_source=x", "instagram", "ABC123"],
    ["https://www.tiktok.com/@creator/video/7391234567890?lang=en", "tiktok", "7391234567890"],
    ["https://youtu.be/dQw4w9WgXcQ?t=1", "youtube", "dQw4w9WgXcQ"],
    ["https://www.pinterest.com/pin/123456789/", "pinterest", "123456789"],
  ])("normalizes supported public URLs", (input, platform, externalId) => {
    expect(normalizeSocialUrl(input)).toMatchObject({ platform, externalId });
  });

  it("rejects unsupported hosts and non-HTTPS URLs", () => {
    expect(() => normalizeSocialUrl("https://example.com/post/1")).toThrow("Unsupported");
    expect(() => normalizeSocialUrl("http://instagram.com/p/ABC123")).toThrow("HTTPS");
  });
});
