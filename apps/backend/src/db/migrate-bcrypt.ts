/**
 * Migration: Add token_lookup column + widen refresh_token_hash for bcrypt.
 * Run with: $env:DATABASE_URL="<url>"; npx tsx src/db/migrate-bcrypt.ts
 */
import pg from "pg";
const { Pool } = pg;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("[migrate] Clearing sessions (old SHA-256 hashes incompatible with bcrypt)...");
  await pool.query(`DELETE FROM public.sessions`);

  console.log("[migrate] Adding token_lookup column...");
  await pool.query(`ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS token_lookup varchar(32)`);

  console.log("[migrate] Widening refresh_token_hash to varchar(60)...");
  await pool.query(`ALTER TABLE public.sessions ALTER COLUMN refresh_token_hash TYPE varchar(60)`);

  console.log("[migrate] Dropping old refresh_token_hash index...");
  await pool.query(`DROP INDEX IF EXISTS sessions_refresh_token_hash_idx`);

  console.log("[migrate] Creating index on token_lookup...");
  await pool.query(`CREATE INDEX IF NOT EXISTS sessions_token_lookup_idx ON public.sessions (token_lookup)`);

  // Verify
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions'
    ORDER BY ordinal_position
  `);

  console.log("\nVerified columns:");
  for (const row of cols.rows) {
    console.log(`  ${row.column_name} (${row.data_type}) nullable=${row.is_nullable}`);
  }

  const indexes = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'sessions'
  `);
  console.log("\nIndexes:");
  for (const row of indexes.rows) {
    console.log(`  ${row.indexname}`);
  }

  await pool.end();
  console.log("\n[migrate] Done.");
}

migrate().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
