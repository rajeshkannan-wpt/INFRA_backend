/**
 * Apply migration 009 (add created_at to contact_hashes) via the real
 * migration path, then re-verify the column exists.
 *
 * Idempotent — safe to re-run in dev, staging, and prod.
 *
 * Run against a specific environment:
 *   $env:DATABASE_URL="postgresql://..."; npx tsx src/db/apply-contact-hashes-created-at.ts
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(__dirname, "migrations", "009_fix_contact_hashes_add_created_at.sql");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url });

  console.log(`[migrate] Applying ${MIGRATION_PATH.split(/\W+/).pop()} ...`);
  const sql = await readFile(MIGRATION_PATH, "utf8");
  await pool.query(sql);
  console.log("[migrate] Migration executed.");

  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'contact_hashes'
    ORDER BY ordinal_position
  `);

  console.log("\ncontact_hashes columns:");
  for (const row of res.rows) {
    console.log(`  ${row.column_name} (${row.data_type}) nullable=${row.is_nullable} default=${row.column_default ?? "null"}`);
  }

  const hasCreatedAt = res.rows.some((r) => r.column_name === "created_at");
  console.log(`\n${hasCreatedAt ? "PASS  created_at present" : "FAIL  created_at missing"}`);

  await pool.end();
  if (!hasCreatedAt) process.exit(1);
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});