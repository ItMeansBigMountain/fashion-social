import { NextRequest,NextResponse } from "next/server";
import { isAdminRoleAllowed } from "@/lib/admin-auth";
import { currentAdmin } from "@/lib/admin-request";
import { moderateSocialPostDb } from "@/lib/admin-store";
export async function POST(request:NextRequest){const admin=await currentAdmin();if(!admin||!isAdminRoleAllowed(admin.role,"social.moderate"))return NextResponse.json({error:"Forbidden"},{status:403});try{const body=await request.json();if(typeof body.id!=="string"||!["approved","rejected"].includes(body.status))throw new Error("Valid post and status are required");return NextResponse.json({post:await moderateSocialPostDb(body.id,body.status,admin.email)});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Moderation failed"},{status:400});}}
