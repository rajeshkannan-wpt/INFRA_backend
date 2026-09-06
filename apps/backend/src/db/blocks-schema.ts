/**
 * DB-2.4 — Blocks table.
 *
 * Keyed by phone_hash (NOT user_id). This ensures a block survives
 * an account delete-and-recreate on the same phone number, with no
 * extra application code — the hash stays stable across accounts.
 */

import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const blocks = pgTable(
  "blocks",
  {
    blockerPhoneHash: text("blocker_phone_hash").notNull(),
    blockedPhoneHash: text("blocked_phone_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerPhoneHash, table.blockedPhoneHash] }),
  ],
);