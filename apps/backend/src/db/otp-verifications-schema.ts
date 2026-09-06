/**
 * DB-2.6 — OTP verifications table.
 *
 * Stores one row per OTP send attempt. The raw OTP code is NEVER
 * stored — only its SHA-256 hash. The SMS gateway polls sms_outbox
 * for dispatch; this table is for verification only.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const otpVerifications = pgTable(
  "otp_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Phone number in E.164 format. */
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),

    /** SHA-256 hex hash of the 6-digit OTP code. Raw code never stored. */
    codeHash: text("code_hash").notNull(),

    /** Number of failed verification attempts so far (0–3). */
    attempts: integer("attempts").notNull().default(0),

    /** When this OTP expires (sent_at + 5 minutes). */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /** Row creation time. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * Lockout timestamp. NULL = not locked.
     * Set to now+30s after 3rd failed attempt.
     */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),

    /** When this OTP was generated and queued. */
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("otp_verifications_phone_number_idx").on(table.phoneNumber),
    index("otp_verifications_sent_at_idx").on(table.sentAt),
  ],
);
