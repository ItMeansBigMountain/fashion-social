import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-request";
import { revokeAdminSessionDb } from "@/lib/admin-store";
export async function POST(){const jar=await cookies();const token=jar.get(ADMIN_COOKIE)?.value;if(token)await revokeAdminSessionDb(token);jar.delete(ADMIN_COOKIE);return NextResponse.json({ok:true});}
