import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { CartInput, CatalogProduct, ProductVariant } from "./commerce";

let client: NeonQueryFunction<false, false> | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return client ??= neon(process.env.DATABASE_URL);
}

type CatalogRow = {
  id: string; slug: string; name: string; brand: string; category: string; description: string; currency: string;
  image_url: string; image_alt: string; color: string; active: boolean; featured: boolean;
  variant_id: string | null; sku: string | null; label: string | null; price_cents: number | null; inventory: number | null;
  reserved: number | null; weight_grams: number | null; variant_active: boolean | null;
  seller_type: string; fulfillment_model: string; creator_handle: string | null;
};
export type DbCatalogProduct = CatalogProduct & { brand: string; category: string; description: string; image: string; imageAlt: string; color: string; featured: boolean; sellerType: string; fulfillmentModel: string; creatorHandle: string | null };

export async function listCatalogDb(includeInactive = false): Promise<DbCatalogProduct[]> {
  const rows = await db().query(`SELECT p.*, c.handle creator_handle, v.id variant_id, v.sku, v.label, v.price_cents, v.inventory, v.reserved, v.weight_grams, v.active variant_active
    FROM products p LEFT JOIN creator_accounts c ON c.id=p.creator_account_id LEFT JOIN product_variants v ON v.product_id=p.id
    WHERE ($1::boolean OR p.active=true) AND ($1::boolean OR v.active=true)
    ORDER BY p.created_at, v.created_at`, [includeInactive]) as CatalogRow[];
  const products = new Map<string, DbCatalogProduct>();
  for (const row of rows) {
    let product = products.get(row.id);
    if (!product) {
      product = { id: row.id, slug: row.slug, name: row.name, brand: row.brand, category: row.category, description: row.description,
        currency: row.currency, image: row.image_url, imageAlt: row.image_alt, color: row.color, active: row.active, featured: row.featured,
        sellerType: row.seller_type, fulfillmentModel: row.fulfillment_model, creatorHandle: row.creator_handle, variants: [] };
      products.set(row.id, product);
    }
    if (row.variant_id && row.sku && row.label && row.price_cents !== null && row.inventory !== null && row.reserved !== null && row.weight_grams !== null) {
      const variant: ProductVariant = { id: row.variant_id, sku: row.sku, label: row.label, priceCents: row.price_cents,
        inventory: Math.max(0, row.inventory - row.reserved), active: Boolean(row.variant_active), weightGrams: row.weight_grams };
      product.variants.push(variant);
    }
  }
  return [...products.values()];
}

export async function saveCartDb(id: string, items: CartInput[]) {
  await db().query(`INSERT INTO carts(id,status,expires_at,updated_at) VALUES($1,'active',now()+interval '30 days',now())
    ON CONFLICT(id) DO UPDATE SET status='active',expires_at=now()+interval '30 days',updated_at=now()`, [id]);
  await db().query("DELETE FROM cart_items WHERE cart_id=$1", [id]);
  for (const item of items) await db().query("INSERT INTO cart_items(cart_id,variant_id,quantity) VALUES($1,$2,$3)", [id, item.variantId, item.quantity]);
  return getCartDb(id);
}

export async function getCartDb(id: string): Promise<{ id: string; items: CartInput[]; updatedAt: string } | null> {
  const rows = await db().query(`SELECT c.id, c.updated_at, ci.variant_id, ci.quantity FROM carts c
    LEFT JOIN cart_items ci ON ci.cart_id=c.id WHERE c.id=$1 AND c.status='active' AND c.expires_at>now() ORDER BY ci.variant_id`, [id]) as Array<{id: string; updated_at: Date | string; variant_id: string | null; quantity: number | null}>;
  if (!rows.length) return null;
  return { id: rows[0].id, updatedAt: new Date(rows[0].updated_at).toISOString(), items: rows.filter((row) => row.variant_id).map((row) => ({ variantId: row.variant_id!, quantity: row.quantity! })) };
}

export async function deleteCartDb(id: string) { await db().query("DELETE FROM carts WHERE id=$1", [id]); }

export type PaidCheckoutInput = {
  eventId: string; sessionId: string; paymentIntentId: string | null; cartId: string; email: string;
  shippingCents: number; taxCents: number; totalCents: number; address: AddressInput;
};
type AddressInput = { name: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };
export async function processPaidCheckoutDb(input: PaidCheckoutInput): Promise<string> {
  const rows = await db().query("SELECT process_paid_checkout($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9::jsonb) order_id", [
    input.eventId, input.sessionId, input.paymentIntentId, input.cartId, input.email,
    input.shippingCents, input.taxCents, input.totalCents, JSON.stringify(input.address),
  ]) as Array<{ order_id: string }>;
  if (!rows[0]?.order_id) throw new Error("Order finalization failed");
  return rows[0].order_id;
}

export async function processRefundDb(eventId: string, paymentIntentId: string): Promise<string> {
  const rows = await db().query("SELECT process_stripe_refund($1,$2) order_id", [eventId,paymentIntentId]) as Array<{ order_id: string }>;
  if (!rows[0]?.order_id) throw new Error("Refund processing failed");
  return rows[0].order_id;
}
