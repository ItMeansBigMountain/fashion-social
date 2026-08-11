import { afterAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { createAdminInviteDb, exchangeAdminInviteDb, getAdminSessionDb, revokeAdminSessionDb } from "./admin-store";
const sql = neon(process.env.DATABASE_URL!);
const email = `owner-${crypto.randomUUID()}@example.com`;
const invite = `invite-${crypto.randomUUID()}`;
const session = `session-${crypto.randomUUID()}`;
afterAll(async () => { await sql.query("DELETE FROM admin_users WHERE email=$1", [email]); });

describe("admin invitations", () => {
  it("exchanges once and supports session revocation", async () => {
    await createAdminInviteDb(email,"owner",invite);
    const admin = await exchangeAdminInviteDb(invite,session);
    expect(admin).toMatchObject({ email, role: "owner" });
    await expect(exchangeAdminInviteDb(invite,`other-${session}`)).rejects.toThrow();
    expect(await getAdminSessionDb(session)).toMatchObject({ email, role: "owner" });
    await revokeAdminSessionDb(session);
    expect(await getAdminSessionDb(session)).toBeNull();
  });
});
