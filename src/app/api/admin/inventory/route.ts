import { NextRequest,NextResponse } from "next/server";
import { isAdminRoleAllowed } from "@/lib/admin-auth";
import { currentAdmin } from "@/lib/admin-request";
import { adjustInventoryDb } from "@/lib/admin-store";
export async function POST(request:NextRequest){const admin=await currentAdmin();if(!admin||!isAdminRoleAllowed(admin.role,"inventory.write"))return NextResponse.json({error:"Forbidden"},{status:403});try{const body=await request.json();if(typeof body.variantId!=="string"||!Number.isInteger(body.delta)||body.delta===0||Math.abs(body.delta)>10000||typeof body.reason!=="string"||body.reason.length<3)throw new Error("Valid variant, integer delta, and reason are required");return NextResponse.json({variant:await adjustInventoryDb(body.variantId,body.delta,body.reason,admin.email)});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid adjustment"},{status:400});}}
