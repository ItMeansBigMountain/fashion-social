import { describe, expect, it } from "vitest";
import { buildCheckoutConfig } from "./checkout-service";
import type { CartQuote } from "./commerce";

const quote: CartQuote = {
  currency: "usd", subtotalCents: 29600, totalQuantity: 2, totalWeightGrams: 1400,
  lines: [{ variantId: "v1", quantity: 2, productId: "p1", productName: "Blazer", sku: "B-XS", variantLabel: "XS", unitPriceCents: 14800, lineTotalCents: 29600, weightGrams: 1400 }],
};

describe("buildCheckoutConfig", () => {
  it("builds server-priced multi-item Stripe lines and free standard shipping", () => {
    const config = buildCheckoutConfig(quote, "cart-1", "https://fashion-social.app");
    expect(config.line_items).toEqual([{ quantity: 2, price_data: { currency: "usd", unit_amount: 14800, product_data: { name: "Blazer", description: "XS · SKU B-XS", metadata: { productId: "p1", variantId: "v1", sku: "B-XS" } } } }]);
    expect(config.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(0);
    expect(config.metadata).toEqual({ cartId: "cart-1" });
    expect(config.automatic_tax).toEqual({ enabled: true });
  });

  it("charges standard shipping below the free threshold", () => {
    const config = buildCheckoutConfig({ ...quote, subtotalCents: 10000 }, "cart-2", "https://example.com");
    expect(config.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(795);
  });
});
