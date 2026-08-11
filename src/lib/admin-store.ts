import { neon } from "@neondatabase/serverless";
import { hashAdminToken, type AdminRole } from "./admin-auth";
import type { ProductMutation } from "./product-admin-service";
import type { SocialSubmission } from "./social-service";
const database = () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return neon(process.env.DATABASE_URL);
};
export type AdminIdentity = { id: string; email: string; role: AdminRole };

export async function createAdminInviteDb(email: string, role: AdminRole, rawToken: string) {
  const sql = database();
  const users = await sql.query("INSERT INTO admin_users(email,role) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=true RETURNING id", [email.toLowerCase(),role]) as Array<{id:string}>;
  const adminId = users[0].id;
  await sql.transaction((tx) => [
    tx.query("UPDATE admin_invites SET consumed_at=now() WHERE admin_id=$1 AND consumed_at IS NULL", [adminId]),
    tx.query("INSERT INTO admin_invites(admin_id,token_hash,expires_at) VALUES($1,$2,now()+interval '24 hours')", [adminId,hashAdminToken(rawToken)]),
  ]);
}
export async function exchangeAdminInviteDb(rawInvite: string, rawSession: string): Promise<AdminIdentity> {
  const rows = await database().query("SELECT * FROM exchange_admin_invite($1,$2,now()+interval '30 days')", [hashAdminToken(rawInvite),hashAdminToken(rawSession)]) as Array<{admin_id:string;email:string;role:AdminRole}>;
  if (!rows[0]) throw new Error("Invitation is invalid or expired");
  return { id: rows[0].admin_id, email: rows[0].email, role: rows[0].role };
}
export async function getAdminSessionDb(rawSession: string): Promise<AdminIdentity | null> {
  const rows = await database().query("UPDATE admin_sessions s SET last_seen_at=now() FROM admin_users u WHERE s.admin_id=u.id AND s.token_hash=$1 AND s.expires_at>now() AND u.active RETURNING u.id,u.email,u.role", [hashAdminToken(rawSession)]) as AdminIdentity[];
  return rows[0] ?? null;
}
export async function revokeAdminSessionDb(rawSession: string) { await database().query("DELETE FROM admin_sessions WHERE token_hash=$1", [hashAdminToken(rawSession)]); }

export async function getAdminDashboardDb() {
  const sql = database();
  const [products,orders,social,shipments,returns,purchaseOrders,supportRequests,creators,creatorSubmissions,fulfillments,refunds,earnings,payouts,audit] = await Promise.all([
    sql.query("SELECT p.id,p.name,p.brand,p.category,p.color,p.description,p.currency,p.image_url,p.image_alt,p.active,p.featured,v.id variant_id,v.sku,v.label,v.price_cents,v.inventory,v.reserved,v.weight_grams,v.active variant_active FROM products p LEFT JOIN product_variants v ON v.product_id=p.id ORDER BY p.created_at,v.label"),
    sql.query("SELECT id,email,status,total_cents,currency,stripe_checkout_session_id,created_at FROM orders ORDER BY created_at DESC LIMIT 100"),
    sql.query("SELECT s.*,array_remove(array_agg(ps.product_id),NULL) product_ids FROM social_posts s LEFT JOIN product_social_posts ps ON ps.social_post_id=s.id GROUP BY s.id ORDER BY s.created_at DESC LIMIT 100"),
    sql.query("SELECT * FROM shipments ORDER BY created_at DESC LIMIT 100"),
    sql.query("SELECT * FROM returns ORDER BY created_at DESC LIMIT 100"),
    sql.query("SELECT po.*,coalesce(jsonb_agg(jsonb_build_object('variantId',poi.variant_id,'ordered',poi.ordered_quantity,'received',poi.received_quantity,'unitCostCents',poi.unit_cost_cents)) FILTER(WHERE poi.variant_id IS NOT NULL),'[]') items FROM purchase_orders po LEFT JOIN purchase_order_items poi ON poi.purchase_order_id=po.id GROUP BY po.id ORDER BY po.created_at DESC LIMIT 100"),
    sql.query("SELECT * FROM support_requests ORDER BY created_at DESC LIMIT 100"),
    sql.query("SELECT * FROM creator_accounts ORDER BY created_at DESC LIMIT 100"),
    sql.query("SELECT s.*,c.handle,c.display_name FROM creator_product_submissions s JOIN creator_accounts c ON c.id=s.creator_account_id ORDER BY s.submitted_at DESC LIMIT 100"),
    sql.query("SELECT f.*,oi.product_name,oi.variant_label,o.order_number,c.handle FROM order_item_fulfillments f JOIN order_items oi ON oi.id=f.order_item_id JOIN orders o ON o.id=f.order_id LEFT JOIN creator_accounts c ON c.id=f.creator_account_id ORDER BY f.created_at DESC LIMIT 200"),
    sql.query("SELECT r.*,o.order_number FROM refund_requests r JOIN orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 100"),
    sql.query("SELECT e.*,c.handle,oi.product_name FROM creator_earnings e JOIN creator_accounts c ON c.id=e.creator_account_id JOIN order_items oi ON oi.id=e.order_item_id ORDER BY e.created_at DESC LIMIT 200"),
    sql.query("SELECT p.*,c.handle FROM creator_payouts p JOIN creator_accounts c ON c.id=p.creator_account_id ORDER BY p.created_at DESC LIMIT 100"),
    sql.query("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100"),
  ]);
  return { products,orders,social,shipments,returns,purchaseOrders,supportRequests,creators,creatorSubmissions,fulfillments,refunds,earnings,payouts,audit };
}

export async function updateSupportRequestDb(id:string,status:"open"|"in_progress"|"resolved"|"closed",actor:string){const rows=await database().query(`WITH changed AS(UPDATE support_requests SET status=$2,updated_at=now() WHERE id=$1 RETURNING *),audit AS(INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) SELECT $3,'support.status_changed','support_request',id::text,jsonb_build_object('status',$2::text) FROM changed) SELECT * FROM changed`,[id,status,actor]);if(!rows[0])throw new Error("Support request not found");return rows[0];}

export async function adjustInventoryDb(variantId: string, delta: number, reason: string, actor: string) {
  const rows=await database().query(`WITH changed AS (
    UPDATE product_variants SET inventory=inventory+$2,updated_at=now() WHERE id=$1 AND inventory+$2>=reserved RETURNING id,inventory,reserved
  ), movement AS (
    INSERT INTO inventory_movements(variant_id,quantity,reason,reference_type,actor) SELECT id,$2,$3,'admin',$4 FROM changed
  ), audit AS (
    INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) SELECT $4,'inventory.adjusted','variant',id,jsonb_build_object('delta',$2,'reason',$3) FROM changed
  ) SELECT * FROM changed`,[variantId,delta,reason,actor]) as Array<{id:string;inventory:number;reserved:number}>;
  const row=rows[0];
  if(!row) throw new Error("Inventory adjustment would violate reserved stock");
  return row;
}

export async function moderateSocialPostDb(id: string,status: "approved"|"rejected",actor:string){
  const rows=await database().query(`WITH changed AS (
    UPDATE social_posts SET status=$2,moderated_by=$3,moderated_at=now(),updated_at=now() WHERE id=$1 AND rights_confirmed RETURNING *
  ), links AS (UPDATE product_social_posts SET public=($2='approved') WHERE social_post_id IN(SELECT id FROM changed)),
  audit AS (INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) SELECT $3,$4,'social_post',id::text,jsonb_build_object('status',$2::text) FROM changed)
  SELECT * FROM changed`,[id,status,actor,`social.${status}`]);
  if(!rows[0]) throw new Error("Post not found or rights are unconfirmed");
  return rows[0];
}

export async function upsertProductDb(product:ProductMutation,actor:string){
 const sql=database();
 const results=await sql.transaction((tx)=>[
  tx.query(`INSERT INTO products(id,slug,name,brand,category,description,currency,image_url,image_alt,color,featured,active)
   VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,brand=excluded.brand,category=excluded.category,description=excluded.description,currency=excluded.currency,image_url=excluded.image_url,image_alt=excluded.image_alt,color=excluded.color,featured=excluded.featured,active=excluded.active,updated_at=now() RETURNING id`,[product.id,product.name,product.brand,product.category,product.description,product.currency,product.imageUrl,product.imageAlt,product.color,product.featured,product.active]),
  ...product.variants.map((variant)=>tx.query(`INSERT INTO product_variants(id,product_id,sku,label,price_cents,inventory,weight_grams,active)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,label=excluded.label,price_cents=excluded.price_cents,weight_grams=excluded.weight_grams,active=excluded.active,updated_at=now()`,[variant.id,product.id,variant.sku,variant.label,variant.priceCents,variant.inventory,variant.weightGrams,variant.active])),
  tx.query("UPDATE product_variants SET active=false,updated_at=now() WHERE product_id=$1 AND NOT(id=ANY($2::text[]))",[product.id,product.variants.map(v=>v.id)]),
  tx.query("INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES($1,'product.upserted','product',$2,jsonb_build_object('variants',$3::integer))",[actor,product.id,product.variants.length]),
 ]);
 return (results[0] as Array<{id:string}>)[0];
}

export async function createManualShipmentDb(input:{orderId:string;carrier:string;service:string;trackingNumber:string},actor:string){const sql=database();const results=await sql.transaction((tx)=>[
 tx.query("INSERT INTO shipments(order_id,provider,carrier,service,tracking_number,status,shipped_at) VALUES($1,'manual',$2,$3,$4,'shipped',now()) RETURNING *",[input.orderId,input.carrier,input.service,input.trackingNumber]),
 tx.query("UPDATE orders SET status='shipped',updated_at=now() WHERE id=$1 AND status IN ('paid','fulfillment_pending')",[input.orderId]),
 tx.query("INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES($1,'shipment.created','order',$2,jsonb_build_object('carrier',$3::text,'tracking',$4::text))",[actor,input.orderId,input.carrier,input.trackingNumber]),
 ]);return (results[0] as Array<Record<string,unknown>>)[0];}

export async function createPurchaseOrderDb(input:{vendor:string;expectedAt?:string;items:Array<{variantId:string;quantity:number;unitCostCents?:number}>},actor:string){const sql=database();const id=crypto.randomUUID();await sql.transaction((tx)=>[
 tx.query("INSERT INTO purchase_orders(id,vendor,status,expected_at) VALUES($1,$2,'ordered',$3)",[id,input.vendor,input.expectedAt??null]),
 ...input.items.map(item=>tx.query("INSERT INTO purchase_order_items(purchase_order_id,variant_id,ordered_quantity,unit_cost_cents) VALUES($1,$2,$3,$4)",[id,item.variantId,item.quantity,item.unitCostCents??null])),
 tx.query("INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES($1,'purchase_order.created','purchase_order',$2,jsonb_build_object('vendor',$3::text))",[actor,id,input.vendor]),
 ]);return{id};}

export async function receivePurchaseOrderItemDb(purchaseOrderId:string,variantId:string,quantity:number,actor:string){const rows=await database().query(`WITH received AS (
 UPDATE purchase_order_items SET received_quantity=received_quantity+$3 WHERE purchase_order_id=$1 AND variant_id=$2 AND received_quantity+$3<=ordered_quantity RETURNING variant_id
),stock AS (UPDATE product_variants SET inventory=inventory+$3,updated_at=now() WHERE id IN(SELECT variant_id FROM received) RETURNING id),movement AS(
 INSERT INTO inventory_movements(variant_id,quantity,reason,reference_type,reference_id,actor) SELECT id,$3,'purchase order receiving','purchase_order',$1::text,$4 FROM stock
),audit AS(INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) SELECT $4,'purchase_order.received','purchase_order',$1::text,jsonb_build_object('variant',$2::text,'quantity',$3::integer) FROM stock)
SELECT id FROM stock`,[purchaseOrderId,variantId,quantity,actor]);if(!rows[0])throw new Error("Receiving quantity exceeds outstanding purchase order quantity");await database().query("UPDATE purchase_orders SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM purchase_order_items WHERE purchase_order_id=$1 AND received_quantity<ordered_quantity) THEN 'received' ELSE 'partial' END,updated_at=now() WHERE id=$1",[purchaseOrderId]);return rows[0];}

export async function updateReturnStatusDb(id:string,from:string,to:string,actor:string){const rows=await database().query("UPDATE returns SET status=$3,updated_at=now() WHERE id=$1 AND status=$2 RETURNING *",[id,from,to]);if(!rows[0])throw new Error("Return changed or was not found");await database().query("INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES($1,'return.status_changed','return',$2,jsonb_build_object('from',$3::text,'to',$4::text))",[actor,id,from,to]);return rows[0];}

export async function submitSocialPostDb(input:SocialSubmission,submitter:string){const sql=database();const id=crypto.randomUUID();const externalId=new URL(input.canonicalUrl).pathname.replace(/^\/+|\/+$/g,"");await sql.transaction((tx)=>[
 tx.query("INSERT INTO social_posts(id,platform,external_id,canonical_url,creator_handle,submitter_email,rights_confirmed,rights_basis,media_url,media_alt,media_source,status) VALUES($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,'pending')",[id,input.platform,externalId,input.canonicalUrl,input.creatorHandle,submitter,input.rightsBasis,input.mediaUrl??null,input.mediaAlt??null,input.mediaSource??null]),
 ...input.productIds.map(productId=>tx.query("INSERT INTO product_social_posts(product_id,social_post_id,relationship,confidence,public) VALUES($1,$2,'admin_curated',1,false)",[productId,id])),
 tx.query("INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES($1,'social.submitted','social_post',$2,jsonb_build_object('products',$3::integer))",[submitter,id,input.productIds.length]),
 ]);return{id};}

export async function addEngagementSnapshotDb(socialPostId:string,counts:{likes?:number;comments?:number;views?:number},source:string,actor:string){const rows=await database().query("INSERT INTO engagement_snapshots(social_post_id,likes,comments,views,source) SELECT id,$2,$3,$4,$5 FROM social_posts WHERE id=$1 AND status='approved' RETURNING *",[socialPostId,counts.likes??null,counts.comments??null,counts.views??null,source]);if(!rows[0])throw new Error("Only approved posts can receive public engagement snapshots");await database().query("INSERT INTO audit_events(actor,action,entity_type,entity_id) VALUES($1,'social.snapshot_added','social_post',$2)",[actor,socialPostId]);return rows[0];}

export async function listPublicSocialEvidenceDb(){return database().query(`SELECT ps.product_id,s.id,s.platform,s.canonical_url,s.creator_handle,e.likes,e.comments,e.views,e.captured_at,e.source
 FROM product_social_posts ps JOIN social_posts s ON s.id=ps.social_post_id LEFT JOIN LATERAL(SELECT * FROM engagement_snapshots WHERE social_post_id=s.id ORDER BY captured_at DESC LIMIT 1)e ON true
 WHERE ps.public AND s.status='approved' AND s.rights_confirmed ORDER BY e.captured_at DESC NULLS LAST`);}
