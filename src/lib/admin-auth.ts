import { createHash } from "node:crypto";

export type AdminRole = "owner" | "catalog" | "fulfillment" | "support";
export type AdminCapability = "product.write" | "social.moderate" | "inventory.write" | "shipment.write" | "refund" | "admin.manage" | "support.write";
const permissions: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  owner: new Set(["product.write","social.moderate","inventory.write","shipment.write","refund","admin.manage","support.write"]),
  catalog: new Set(["product.write","social.moderate","inventory.write"]),
  fulfillment: new Set(["inventory.write","shipment.write"]),
  support: new Set(["support.write"]),
};
export const hashAdminToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const isAdminRoleAllowed = (role: AdminRole, capability: AdminCapability) => permissions[role].has(capability);
export const sessionCookieOptions = (production: boolean) => ({ httpOnly: true, secure: production, sameSite: "strict" as const, path: "/", maxAge: 60 * 60 * 24 * 30 });
