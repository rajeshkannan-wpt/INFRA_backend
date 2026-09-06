import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Drop the incorrectly-created table
  await pool.query('DROP TABLE IF EXISTS "public"."sessions" CASCADE');
  console.log("Dropped public.sessions");

  // Recreate with our correct schema
  await pool.query(`
    CREATE TABLE "public"."sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" varchar(64) NOT NULL,
      "device_id" varchar(64) NOT NULL,
      "refresh_token_hash" varchar(64) NOT NULL,
      "refresh_token_expires_at" timestamp with time zone NOT NULL,
      "revoked_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX "sessions_user_id_idx" ON "public"."sessions" USING btree ("user_id");
    CREATE INDEX "sessions_refresh_token_hash_idx" ON "public"."sessions" USING btree ("refresh_token_hash");
  `);
  console.log("Created public.sessions with correct schema");

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

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
