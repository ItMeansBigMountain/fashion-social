import Link from "next/link";
import { currentAdmin } from "@/lib/admin-request";
import { getAdminDashboardDb } from "@/lib/admin-store";
import AdminConsole from "./admin-console";
export const dynamic="force-dynamic";
export default async function AdminPage(){const admin=await currentAdmin();if(!admin)return <main className="admin-access"><p className="eyebrow">Fashion Social operations</p><h1>Invitation required</h1><p>Administrator access uses a one-time owner invitation and a secure, revocable session. Request a fresh invitation from the account owner.</p><Link href="/">Return to storefront</Link></main>;const data=await getAdminDashboardDb();return <AdminConsole admin={admin} data={JSON.parse(JSON.stringify(data))}/>;}
