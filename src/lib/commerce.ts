export type ProductVariant = {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  inventory: number;
  active: boolean;
  weightGrams: number;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  currency: string;
  variants: ProductVariant[];
};

export type CartInput = { variantId: string; quantity: number };
export type CartLine = CartInput & {
  productId: string;
  productName: string;
  sku: string;
  variantLabel: string;
  unitPriceCents: number;
  lineTotalCents: number;
  weightGrams: number;
};
export type CartQuote = {
  lines: CartLine[];
  currency: string;
  subtotalCents: number;
  totalQuantity: number;
  totalWeightGrams: number;
};

export function buildCartQuote(catalog: CatalogProduct[], input: CartInput[]): CartQuote {
  if (!Array.isArray(input) || input.length === 0) throw new Error("Cart is empty");
  const lines = input.map(({ variantId, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("Invalid quantity");
    const product = catalog.find((candidate) => candidate.active && candidate.variants.some((variant) => variant.id === variantId));
    const variant = product?.variants.find((candidate) => candidate.id === variantId && candidate.active);
    if (!product || !variant) throw new Error("Product variant is unavailable");
    if (variant.inventory < quantity) throw new Error(`${product.name} (${variant.label}) is out of stock`);
    return {
      variantId,
      quantity,
      productId: product.id,
      productName: product.name,
      sku: variant.sku,
      variantLabel: variant.label,
      unitPriceCents: variant.priceCents,
      lineTotalCents: variant.priceCents * quantity,
      weightGrams: variant.weightGrams * quantity,
      currency: product.currency.toLowerCase(),
    };
  });
  const currencies = new Set(lines.map((line) => line.currency));
  if (currencies.size !== 1) throw new Error("Cart items must use one currency");
  return {
    lines: lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      productId: line.productId,
      productName: line.productName,
      sku: line.sku,
      variantLabel: line.variantLabel,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      weightGrams: line.weightGrams,
    })),
    currency: lines[0].currency,
    subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalWeightGrams: lines.reduce((sum, line) => sum + line.weightGrams, 0),
  };
}

export type OrderStatus = "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "canceled" | "refunded";
const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "canceled"],
  paid: ["processing", "refunded", "canceled"],
  processing: ["shipped", "refunded", "canceled"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  canceled: [],
  refunded: [],
};
export function transitionOrder(current: OrderStatus, next: OrderStatus): OrderStatus {
  if (!transitions[current].includes(next)) throw new Error(`Invalid order transition: ${current} → ${next}`);
  return next;
}

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "pinterest";
export type NormalizedSocialUrl = { platform: SocialPlatform; externalId: string; canonicalUrl: string };

export function normalizeSocialUrl(input: string): NormalizedSocialUrl {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Invalid social URL"); }
  if (url.protocol !== "https:") throw new Error("Social URLs must use HTTPS");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let platform: SocialPlatform;
  let externalId: string | undefined;
  if (host === "instagram.com" && ["p", "reel", "tv"].includes(parts[0])) [platform, externalId] = ["instagram", parts[1]];
  else if (host === "tiktok.com" && parts[1] === "video") [platform, externalId] = ["tiktok", parts[2]];
  else if (host === "youtu.be") [platform, externalId] = ["youtube", parts[0]];
  else if ((host === "youtube.com" || host === "m.youtube.com") && parts[0] === "watch") [platform, externalId] = ["youtube", url.searchParams.get("v") ?? undefined];
  else if (host === "pinterest.com" && parts[0] === "pin") [platform, externalId] = ["pinterest", parts[1]];
  else throw new Error("Unsupported social platform URL");
  if (!externalId || !/^[A-Za-z0-9_-]{5,128}$/.test(externalId)) throw new Error("Invalid social post identifier");
  const canonicalUrl = platform === "instagram" ? `https://www.instagram.com/p/${externalId}/`
    : platform === "tiktok" ? `https://www.tiktok.com/@creator/video/${externalId}`
    : platform === "youtube" ? `https://youtu.be/${externalId}`
    : `https://www.pinterest.com/pin/${externalId}/`;
  return { platform, externalId, canonicalUrl };
}
