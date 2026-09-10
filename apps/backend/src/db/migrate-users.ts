import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env from backend root
try {
  const env = readFileSync(resolve(import.meta.dirname, "../../.env"), "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found — rely on shell env */ }

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Either set it in apps/backend/.env or pass it as an env var.");
    process.exit(1);
  }
  console.log(`Connecting to: ${url.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  const pool = new Pool({ connectionString: url });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "public"."users" (
      "id" varchar(64) PRIMARY KEY NOT NULL,
      "phone_number" varchar(20) NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_number_unique"
      ON "public"."users" USING btree ("phone_number");
    CREATE INDEX IF NOT EXISTS "users_phone_number_idx"
      ON "public"."users" USING btree ("phone_number");
  `);
  console.log("users table created");

  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `);

  console.log("\nVerified columns:");
  for (const row of res.rows) {
    console.log(`  ${row.column_name} (${row.data_type}) nullable=${row.is_nullable}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
