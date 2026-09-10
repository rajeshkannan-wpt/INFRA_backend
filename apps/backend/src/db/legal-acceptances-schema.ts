/**
 * DB-2.6 — Legal acceptances table.
 *
 * Records that a user has accepted the terms of service / privacy
 * policy. OTP verification (ONB-1.3) checks this table BEFORE
 * allowing the code to be verified — without a matching row the
 * endpoint rejects the request regardless of what the client sent.
 *
 * One row per phone number per accepted legal version. The
 * `accepted_at` timestamp is the audit trail.
 */

import { pgTable, varchar, timestamp, index } from "drizzle-orm/pg-core";

export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    /** Phone number that accepted (E.164 format). */
    phoneNumber: varchar("phone_number", { length: 20 })
      .primaryKey()
      .notNull(),

    /** Version string of the accepted legal document (e.g. "v1.0-2024-01-15"). */
    legalVersion: varchar("legal_version", { length: 64 }).notNull(),

    /** Timestamp when acceptance was recorded. */
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Lookup by phone number is the hot path (OTP-verify gate check).
    index("legal_acceptances_phone_number_idx").on(table.phoneNumber),
  ],
);
