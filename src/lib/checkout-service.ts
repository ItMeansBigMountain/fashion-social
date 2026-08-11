import type { CartQuote } from "./commerce";

export function buildCheckoutConfig(quote: CartQuote, cartId: string, origin: string) {
  const shippingCents = quote.subtotalCents >= 15000 ? 0 : 795;
  return {
    mode: "payment" as const,
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?cart=open`,
    allow_promotion_codes: true,
    billing_address_collection: "auto" as const,
    shipping_address_collection: { allowed_countries: ["US"] as ["US"] },
    automatic_tax: { enabled: true },
    customer_creation: "always" as const,
    metadata: { cartId },
    line_items: quote.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: quote.currency,
        unit_amount: line.unitPriceCents,
        product_data: {
          name: line.productName,
          description: `${line.variantLabel} · SKU ${line.sku}`,
          metadata: { productId: line.productId, variantId: line.variantId, sku: line.sku },
        },
      },
    })),
    shipping_options: [{
      shipping_rate_data: {
        type: "fixed_amount" as const,
        fixed_amount: { amount: shippingCents, currency: quote.currency },
        display_name: shippingCents === 0 ? "Free standard shipping" : "Standard shipping",
        delivery_estimate: { minimum: { unit: "business_day" as const, value: 3 }, maximum: { unit: "business_day" as const, value: 7 } },
      },
    }],
  };
}
