import { afterAll,describe,expect,it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { adjustInventoryDb,upsertProductDb } from "./admin-store";
import { listCatalogDb } from "./postgres-store";
const sql=neon(process.env.DATABASE_URL!);const suffix=crypto.randomUUID().slice(0,8);const id=`test-product-${suffix}`;const variantId=`${id}-s`;
const product={id,name:"Test Product",brand:"Fashion Social",category:"Testing",color:"Black",description:"A temporary integration test product.",currency:"usd" as const,imageUrl:"/products/test.jpg",imageAlt:"Temporary test product",featured:false,active:true,variants:[{id:variantId,sku:`TEST-${suffix}`,label:"S",priceCents:2500,inventory:5,weightGrams:400,active:true}]};
afterAll(async()=>{await sql.query("DELETE FROM audit_events WHERE entity_id=$1 OR entity_id=$2",[id,variantId]);await sql.query("DELETE FROM inventory_movements WHERE variant_id=$1",[variantId]);await sql.query("DELETE FROM products WHERE id=$1",[id]);});
describe("admin catalog persistence",()=>{it("creates products and never overwrites existing stock through metadata edits",async()=>{await upsertProductDb(product,"test@example.com");await adjustInventoryDb(variantId,2,"test receiving","test@example.com");await upsertProductDb({...product,name:"Renamed Product",variants:[{...product.variants[0],inventory:0}]},"test@example.com");const saved=(await listCatalogDb()).find(p=>p.id===id)!;expect(saved.name).toBe("Renamed Product");expect(saved.variants[0].inventory).toBe(7);});});
