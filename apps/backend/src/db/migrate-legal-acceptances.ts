import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query('DROP TABLE IF EXISTS "public"."legal_acceptances" CASCADE');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "public"."legal_acceptances" (
      "phone_number" varchar(20) PRIMARY KEY NOT NULL,
      "legal_version" varchar(64) NOT NULL,
      "accepted_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "legal_acceptances_phone_number_idx"
      ON "public"."legal_acceptances" USING btree ("phone_number");
  `);
  console.log("legal_acceptances table created");

  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_acceptances'
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
