/**
 * DB-2.6 — SMS outbox table.
 *
 * Outbox pattern (§18.1): the OTP endpoint writes a row here;
 * the SMS gateway device polls for pending rows, dispatches via
 * the SMS provider, and marks them as sent/failed.
 *
 * SECURITY: The raw OTP code is NEVER stored in this table.
 * Only the SHA-256 hash is stored. The SMS gateway must look up
 * the OTP from a secure source (e.g., environment variable or
 * a temporary encrypted store) — NOT from this table.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const smsOutbox = pgTable(
  "sms_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Recipient phone number (E.164). */
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),

    /**
     * SHA-256 hash of the OTP code.
     * The gateway uses this to verify which OTP to send,
     * but cannot reverse it to obtain the raw code.
     */
    otpHash: text("otp_hash").notNull(),

    /**
     * Dispatch status.
     *   pending  — ready for gateway pickup
     *   sent     — gateway dispatched successfully
     *   failed   — gateway failed to dispatch
     */
    status: varchar("status", { length: 20 }).notNull().default("pending"),

    /** Number of dispatch attempts by the gateway. */
    attempts: integer("attempts").notNull().default(0),

    /** Row creation time. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** When the gateway last attempted dispatch. NULL until attempted. */
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("sms_outbox_status_idx").on(table.status),
    index("sms_outbox_created_at_idx").on(table.createdAt),
    check("sms_outbox_status_check", sql`${table.status} IN ('pending', 'sent', 'failed')`),
  ],
);
