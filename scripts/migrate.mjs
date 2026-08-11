import { readFile, readdir } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);
const directory = new URL("../migrations/", import.meta.url);
for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
  const migration = await readFile(new URL(filename, directory), "utf8");
  const statements = migration.includes("-- statement-breakpoint")
    ? migration.split("-- statement-breakpoint")
    : migration.split(/;\s*(?:\n|$)/);
  for (const statement of statements.map((value) => value.trim()).filter(Boolean)) await sql.query(statement);
  console.log(`Applied ${filename}`);
}
const rows = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
console.log(`Migration complete: ${rows.length} tables`);
console.log(rows.map((row) => row.tablename).join(", "));
