/**
 * Apply the sessions table migration to Supabase.
 * Run: pnpm --filter @wpt/backend exec tsx src/db/apply-migration.ts
 */

import pg from "pg";

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url });

  const sql = `
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" varchar(64) NOT NULL,
      "device_id" varchar(64) NOT NULL,
      "refresh_token_hash" varchar(64) NOT NULL,
      "refresh_token_expires_at" timestamp with time zone NOT NULL,
      "revoked_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "sessions_refresh_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");
  `;

  await pool.query(sql);
  console.log("Sessions table created successfully.");

  // Verify the table exists
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'sessions'
    ORDER BY ordinal_position
  `);

  console.log("\nSessions table columns:");
  for (const row of res.rows) {
    console.log(`  ${row.column_name} (${row.data_type}) nullable=${row.is_nullable}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
