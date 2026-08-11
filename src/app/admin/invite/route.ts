import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/admin-auth";
import { ADMIN_COOKIE } from "@/lib/admin-request";
import { exchangeAdminInviteDb } from "@/lib/admin-store";
export async function GET(request:NextRequest){
 const token=new URL(request.url).searchParams.get("token"); if(!token) return NextResponse.redirect(new URL("/admin?error=missing",request.url));
 const session=randomBytes(32).toString("base64url");
 try{ await exchangeAdminInviteDb(token,session); const response=NextResponse.redirect(new URL("/admin",request.url)); response.cookies.set(ADMIN_COOKIE,session,sessionCookieOptions(process.env.NODE_ENV==="production")); return response; }
 catch{return NextResponse.redirect(new URL("/admin?error=invalid",request.url));}
}
