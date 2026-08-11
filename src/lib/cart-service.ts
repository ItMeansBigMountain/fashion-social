import { randomUUID } from "node:crypto";
import type { CartInput } from "./commerce";
import { verifyVoterToken } from "./vote-service";

export function cartIdentity(token: string | undefined, secret: string) {
  const existing = token ? verifyVoterToken(token, secret) : null;
  return existing ? { id: existing, fresh: false } : { id: randomUUID(), fresh: true };
}

export function parseCartItems(input: unknown): CartInput[] {
  if (!input || typeof input !== "object" || !("items" in input) || !Array.isArray(input.items)) throw new Error("Cart items are required");
  if (input.items.length > 50) throw new Error("Cart has too many lines");
  const merged = new Map<string, number>();
  for (const item of input.items) {
    if (!item || typeof item !== "object") throw new Error("Invalid cart item");
    const variantId = "variantId" in item ? item.variantId : undefined;
    const quantity = "quantity" in item ? item.quantity : undefined;
    if (typeof variantId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(variantId)) throw new Error("Invalid variant ID");
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 20) throw new Error("Invalid quantity");
    const total = (merged.get(variantId) ?? 0) + (quantity as number);
    if (total > 20) throw new Error("Invalid quantity");
    merged.set(variantId, total);
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}
