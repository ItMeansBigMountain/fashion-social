import { randomUUID } from "node:crypto";
import { buildCartQuote, normalizeSocialUrl, type CartInput, type CatalogProduct, type OrderStatus } from "./commerce";

export type Cart = { id: string; items: CartInput[]; updatedAt: string };
export type Address = { name: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };
export type Order = { id: string; idempotencyKey: string; cartId: string; email: string; shippingAddress: Address | null; status: OrderStatus; createdAt: string };
export type AuditEvent = { id: string; actor: string; action: string; entityType: string; entityId: string; createdAt: string };
export type SocialPostRecord = {
  id: string; productId: string; platform: string; externalId: string; canonicalUrl: string;
  submitterEmail: string; rightsConfirmed: boolean; status: "pending" | "approved" | "rejected";
  createdAt: string; moderatedBy?: string;
};

const clone = <T>(value: T): T => structuredClone(value);
export class MemoryCommerceStore {
  private products = new Map<string, CatalogProduct>();
  private carts = new Map<string, Cart>();
  private orders = new Map<string, Order>();
  private reservations = new Map<string, { variantId: string; quantity: number }[]>();
  private posts = new Map<string, SocialPostRecord>();
  private audit: AuditEvent[] = [];

  constructor(products: CatalogProduct[] = []) { products.forEach((product) => this.products.set(product.id, clone(product))); }
  async listProducts() { return clone([...this.products.values()]); }
  async saveProduct(product: CatalogProduct, actor: string) {
    const action = this.products.has(product.id) ? "product.updated" : "product.created";
    this.products.set(product.id, clone(product));
    this.record(actor, action, "product", product.id);
    return clone(product);
  }
  async listAuditEvents() { return clone(this.audit); }
  async saveCart(cart: Cart) { this.carts.set(cart.id, clone(cart)); return clone(cart); }
  async getCart(id: string) { const value = this.carts.get(id); return value ? clone(value) : null; }
  async reserveInventory(key: string, items: CartInput[]) {
    const prior = this.reservations.get(key);
    if (prior) return clone(prior);
    buildCartQuote([...this.products.values()], items);
    for (const item of items) for (const product of this.products.values()) {
      const variant = product.variants.find((entry) => entry.id === item.variantId);
      if (variant) variant.inventory -= item.quantity;
    }
    this.reservations.set(key, clone(items));
    return clone(items);
  }
  async createOrder(key: string, input: { cartId: string; email: string; shippingAddress: Address | null }) {
    const existing = [...this.orders.values()].find((order) => order.idempotencyKey === key);
    if (existing) return clone(existing);
    if (!this.carts.has(input.cartId)) throw new Error("Cart not found");
    const order: Order = { id: randomUUID(), idempotencyKey: key, ...input, status: "pending_payment", createdAt: new Date().toISOString() };
    this.orders.set(order.id, order);
    return clone(order);
  }
  async listOrders() { return clone([...this.orders.values()]); }
  async submitSocialPost(input: { productId: string; url: string; submitterEmail: string; rightsConfirmed: boolean }) {
    if (!this.products.has(input.productId)) throw new Error("Product not found");
    if (!input.rightsConfirmed) throw new Error("Usage rights confirmation is required");
    const normalized = normalizeSocialUrl(input.url);
    const post: SocialPostRecord = { id: randomUUID(), productId: input.productId, ...normalized, submitterEmail: input.submitterEmail, rightsConfirmed: true, status: "pending", createdAt: new Date().toISOString() };
    this.posts.set(post.id, post);
    return clone(post);
  }
  async moderateSocialPost(id: string, status: "approved" | "rejected", actor: string) {
    const post = this.posts.get(id);
    if (!post) throw new Error("Social post not found");
    post.status = status; post.moderatedBy = actor;
    this.record(actor, `social.${status}`, "social_post", id);
    return clone(post);
  }
  private record(actor: string, action: string, entityType: string, entityId: string) {
    this.audit.push({ id: randomUUID(), actor, action, entityType, entityId, createdAt: new Date().toISOString() });
  }
}
