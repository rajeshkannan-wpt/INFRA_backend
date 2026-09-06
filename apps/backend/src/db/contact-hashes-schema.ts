/**
 * DB-2.3 — Contact hashes table.
 *
 * Privacy-preserving contact matching: stores SHA-256 hashes of
 * E.164-normalized phone numbers (with a global salt) instead of
 * raw phone numbers. No PII is stored.
 *
 * phone_hash is the PRIMARY KEY — one row per unique phone number.
 * user_id links the hash to the owning account (FK -> users).
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users-schema.js";

export const contactHashes = pgTable(
  "contact_hashes",
  {
    phoneHash: text("phone_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_contact_hashes_user_id").on(table.userId),
  ],
);
