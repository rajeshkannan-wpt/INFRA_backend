import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Returns a shared Drizzle instance backed by a pg Pool.
 *
 * The pool reads DATABASE_URL from the environment once and reuses
 * connections for the lifetime of the process.
 */
export function getDb() {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  _db = drizzle(pool, { schema });
  return _db;
}

export { schema };

/** Drizzle database type — use for optional db parameters in auth functions. */
export type AppDb = ReturnType<typeof drizzle<typeof schema>>;
