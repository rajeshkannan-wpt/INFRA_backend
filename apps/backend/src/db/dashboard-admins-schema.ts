/**
 * DB-2.5 — Dashboard admins table.
 *
 * Separate table from the end-user authentication store — admins
 * never share the same credentials or session space as regular
 * users. password_hash and owner_reset_token_hash are always
 * stored as hashes (never plaintext).
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  check,
} from "drizzle-orm/pg-core";

export const dashboardAdmins = pgTable(
  "dashboard_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 256 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 32 }).notNull().default("admin"),
    isTestAccount: boolean("is_test_account").notNull().default(false),
    ownerResetTokenHash: text("owner_reset_token_hash"),
    ownerResetTokenExpiresAt: timestamp("owner_reset_token_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);