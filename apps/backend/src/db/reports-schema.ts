/**
 * DB-2.4 — Reports table.
 *
 * Keyed by phone_hash (NOT user_id). One row per user report.
 * Holds the bounded decrypted_message_snapshot (jsonb) that is
 * populated automatically by a database trigger on report_evidence
 * (see migration 005_fix_reports_and_moderation.sql).
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";

export const reportStatus = pgEnum("report_status", [
  "pending",
  "reviewed",
  "actioned",
  "dismissed",
]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterPhoneHash: text("reporter_phone_hash").notNull(),
    reportedPhoneHash: text("reported_phone_hash").notNull(),
    status: reportStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    actionedAt: timestamp("actioned_at", { withTimezone: true }),
    decryptedMessageSnapshot: jsonb("decrypted_message_snapshot"),
  },
  (table) => [
    index("reports_reporter_phone_hash_idx").on(table.reporterPhoneHash),
    index("reports_reported_phone_hash_idx").on(table.reportedPhoneHash),
    index("reports_status_idx").on(table.status),
  ],
);