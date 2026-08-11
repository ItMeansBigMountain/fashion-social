import { cookies } from "next/headers";
import { getAdminSessionDb } from "./admin-store";
export const ADMIN_COOKIE = "fashion_admin";
export async function currentAdmin() { const token=(await cookies()).get(ADMIN_COOKIE)?.value; return token ? getAdminSessionDb(token) : null; }
