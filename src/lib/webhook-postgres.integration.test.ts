import { afterAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { getCartDb, listCatalogDb, processPaidCheckoutDb, saveCartDb } from "./postgres-store";

const sql = neon(process.env.DATABASE_URL!);
const cartId = crypto.randomUUID();
const eventId = `evt_test_${crypto.randomUUID()}`;
const sessionId = `cs_test_${crypto.randomUUID()}`;
const paymentIntentId = `pi_test_${crypto.randomUUID()}`;
let variantId = "";
let initialInventory = 0;
let orderId = "";
afterAll(async () => {
  if (orderId) {
    await sql.query("DELETE FROM audit_events WHERE entity_id=$1", [orderId]);
    await sql.query("DELETE FROM inventory_movements WHERE reference_id=$1", [orderId]);
    await sql.query("DELETE FROM payment_events WHERE event_id=$1", [eventId]);
    await sql.query("DELETE FROM orders WHERE id=$1", [orderId]);
  }
  if (variantId) await sql.query("UPDATE product_variants SET inventory=$2 WHERE id=$1", [variantId,initialInventory]);
  await sql.query("DELETE FROM carts WHERE id=$1", [cartId]);
});

describe("paid checkout transaction", () => {
  it("creates one order and decrements stock once for duplicate events", async () => {
    const catalog = await listCatalogDb();
    const variant = catalog.find((p) => p.id === "city-knit")!.variants[0];
    variantId = variant.id; initialInventory = variant.inventory;
    await saveCartDb(cartId, [{ variantId, quantity: 1 }]);
    const input = { eventId, sessionId, paymentIntentId, cartId, email: "buyer@example.com", shippingCents: 795, taxCents: 0, totalCents: variant.priceCents + 795, address: { name: "Buyer", line1: "1 Main St", city: "Chicago", state: "IL", postalCode: "60601", country: "US" } };
    orderId = await processPaidCheckoutDb(input);
    expect(await processPaidCheckoutDb(input)).toBe(orderId);
    const rows = await sql.query("SELECT status,total_cents FROM orders WHERE id=$1", [orderId]);
    expect(rows[0]).toMatchObject({ status: "paid", total_cents: variant.priceCents + 795 });
    const after = (await listCatalogDb()).find((p) => p.id === "city-knit")!.variants.find((v) => v.id === variantId)!;
    expect(after.inventory).toBe(initialInventory - 1);
    expect((await getCartDb(cartId))).toBeNull();
  });
});
