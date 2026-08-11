import { NextResponse } from "next/server";
import { listCatalogDb } from "@/lib/postgres-store";

export async function GET() {
  try { return NextResponse.json({ products: await listCatalogDb() }); }
  catch { return NextResponse.json({ error: "Catalog is temporarily unavailable." }, { status: 503 }); }
}
