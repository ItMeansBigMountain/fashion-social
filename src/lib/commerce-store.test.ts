import { describe, expect, it } from "vitest";
import { MemoryCommerceStore } from "./commerce-store";
import type { CatalogProduct } from "./commerce";

const product: CatalogProduct = {
  id: "p1", slug: "coat", name: "Coat", active: true, currency: "usd",
  variants: [{ id: "v1", sku: "COAT-S", label: "S", priceCents: 12000, inventory: 3, active: true, weightGrams: 900 }],
};

describe("MemoryCommerceStore", () => {
  it("creates and updates products with audit events", async () => {
    const store = new MemoryCommerceStore();
    await store.saveProduct(product, "admin@example.com");
    await store.saveProduct({ ...product, name: "Gallery Coat" }, "admin@example.com");
    expect((await store.listProducts())[0].name).toBe("Gallery Coat");
    expect(await store.listAuditEvents()).toHaveLength(2);
  });

  it("reserves inventory idempotently and prevents overselling", async () => {
    const store = new MemoryCommerceStore([product]);
    const first = await store.reserveInventory("checkout-1", [{ variantId: "v1", quantity: 2 }]);
    const repeated = await store.reserveInventory("checkout-1", [{ variantId: "v1", quantity: 2 }]);
    expect(repeated).toEqual(first);
    expect((await store.listProducts())[0].variants[0].inventory).toBe(1);
    await expect(store.reserveInventory("checkout-2", [{ variantId: "v1", quantity: 2 }])).rejects.toThrow("stock");
  });

  it("persists carts and creates one order per idempotency key", async () => {
    const store = new MemoryCommerceStore([product]);
    await store.saveCart({ id: "cart-1", items: [{ variantId: "v1", quantity: 1 }], updatedAt: "2026-08-11T00:00:00.000Z" });
    expect((await store.getCart("cart-1"))?.items).toHaveLength(1);
    const order = await store.createOrder("session-1", { cartId: "cart-1", email: "buyer@example.com", shippingAddress: null });
    expect(await store.createOrder("session-1", { cartId: "cart-1", email: "buyer@example.com", shippingAddress: null })).toEqual(order);
    expect(await store.listOrders()).toHaveLength(1);
  });

  it("queues normalized social submissions for rights review", async () => {
    const store = new MemoryCommerceStore([product]);
    const post = await store.submitSocialPost({ productId: "p1", url: "https://www.instagram.com/p/ABC123/", submitterEmail: "creator@example.com", rightsConfirmed: true });
    expect(post).toMatchObject({ platform: "instagram", externalId: "ABC123", status: "pending", rightsConfirmed: true });
    const approved = await store.moderateSocialPost(post.id, "approved", "admin@example.com");
    expect(approved.status).toBe("approved");
  });
});
