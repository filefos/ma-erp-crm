import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS signature text`);
  console.log("✓ Added signature column to companies table");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
