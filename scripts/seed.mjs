import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);
const products = [
  ["after-dark-blazer","after-dark-blazer","After Dark Blazer","Wornly Studio","Jackets",14800,"Ink black",["XS","S","M","L","XL"],700,"https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=88","Model wearing a structured black blazer","A clean oversized blazer with a sharp shoulder and fluid drape—built for late dinners and early meetings.",true],
  ["sienna-slip","sienna-slip","Sienna Slip","Forma","Dresses",11800,"Sienna",["XS","S","M","L"],420,"https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=88","Woman in a warm-toned flowing dress","Bias-cut satin with an easy low back. The kind of dress that catches light and compliments.",false],
  ["city-knit","city-knit","City Rib Knit","Wornly Studio","Tops",7200,"Oat",["XS","S","M","L","XL"],280,"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=88","Street-style model wearing a fitted knit top","A sculpted everyday knit with a square neckline and just enough stretch.",false],
  ["gallery-coat","gallery-coat","Gallery Coat","North Line","Jackets",21000,"Bone",["S","M","L"],1300,"https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1200&q=88","Minimal fashion rack with a tailored neutral coat","Longline wool-blend tailoring with concealed buttons and a dramatic, quiet silhouette.",false],
  ["studio-scarf","studio-scarf","Studio Silk Scarf","Forma","Accessories",5400,"Espresso print",["One size"],90,"https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=88&crop=faces","Editorial fashion styling with a silk accessory","Hand-rolled silk in an abstract espresso print. Tie it, wrap it, make it yours.",false],
  ["frame-dress","frame-dress","Frame Mini Dress","North Line","Dresses",13200,"Midnight",["XS","S","M","L"],480,"https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=88&crop=top","Editorial model wearing a statement dress","A structured mini with architectural seams and an unexpectedly comfortable fit.",false],
];
for (const [id,slug,name,brand,category,price,color,sizes,weight,imageUrl,imageAlt,description,featured] of products) {
  await sql.query(`INSERT INTO products(id,slug,name,brand,category,description,currency,image_url,image_alt,color,active,featured)
    VALUES($1,$2,$3,$4,$5,$6,'usd',$7,$8,$9,true,$10)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,brand=excluded.brand,category=excluded.category,description=excluded.description,image_url=excluded.image_url,image_alt=excluded.image_alt,color=excluded.color,featured=excluded.featured,updated_at=now()`,
    [id,slug,name,brand,category,description,imageUrl,imageAlt,color,featured]);
  for (const size of sizes) {
    const safe = size.toLowerCase().replace(/[^a-z0-9]+/g,"-");
    await sql.query(`INSERT INTO product_variants(id,product_id,sku,label,price_cents,inventory,reserved,weight_grams,active)
      VALUES($1,$2,$3,$4,$5,25,0,$6,true)
      ON CONFLICT(id) DO UPDATE SET label=excluded.label,price_cents=excluded.price_cents,weight_grams=excluded.weight_grams,active=true,updated_at=now()`,
      [`${id}-${safe}`,id,`${id.toUpperCase().replace(/-/g,"").slice(0,12)}-${safe.toUpperCase()}`,size,price,weight]);
  }
}
const counts = await sql`SELECT (SELECT count(*) FROM products) products, (SELECT count(*) FROM product_variants) variants`;
console.log(`Seed complete: ${counts[0].products} products, ${counts[0].variants} variants`);
