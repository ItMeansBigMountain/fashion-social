import { NextRequest,NextResponse } from "next/server";
import { isAdminRoleAllowed } from "@/lib/admin-auth";
import { currentAdmin } from "@/lib/admin-request";
import { upsertProductDb } from "@/lib/admin-store";
import { parseProductMutation } from "@/lib/product-admin-service";
export async function PUT(request:NextRequest){const admin=await currentAdmin();if(!admin||!isAdminRoleAllowed(admin.role,"product.write"))return NextResponse.json({error:"Forbidden"},{status:403});try{const product=parseProductMutation(await request.json());return NextResponse.json({product:await upsertProductDb(product,admin.email)});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Product update failed"},{status:400});}}
