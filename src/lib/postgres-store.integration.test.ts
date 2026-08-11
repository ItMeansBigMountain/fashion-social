import { afterAll, describe, expect, it } from "vitest";
import { deleteCartDb, getCartDb, listCatalogDb, saveCartDb } from "./postgres-store";

const cartId = crypto.randomUUID();
afterAll(async () => { await deleteCartDb(cartId); });

describe("Postgres commerce store", () => {
  it("loads seeded products with active variants", async () => {
    const products = await listCatalogDb();
    expect(products).toHaveLength(6);
    expect(products.every((product) => product.variants.length > 0)).toBe(true);
    expect(products.flatMap((product) => product.variants).every((variant) => variant.priceCents > 0)).toBe(true);
  });

  it("persists and updates a cart", async () => {
    const catalog = await listCatalogDb();
    const variantId = catalog[0].variants[0].id;
    await saveCartDb(cartId, [{ variantId, quantity: 1 }]);
    expect(await getCartDb(cartId)).toMatchObject({ id: cartId, items: [{ variantId, quantity: 1 }] });
    await saveCartDb(cartId, [{ variantId, quantity: 2 }]);
    expect((await getCartDb(cartId))?.items[0].quantity).toBe(2);
  });
});
