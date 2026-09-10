/**
 * DB-2.5 — Audit log table.
 *
 * Records every moderation action performed by a dashboard admin.
 * Following the DB-2.5 spec:
 *   - dashboard_admin_id references dashboard_admins (NOT auth.users)
 *   - report_id references the report being acted on
 *   - action is a warn/restrict/ban/dismiss enum
 *   - acted_at records when the action happened
 *
 * Moderation is transaction-safe: the admin_moderations tables
 * are written by public.moderate_report() such that the report
 * status change and this audit row commit together or not at all.
 */

import {
  pgTable,
  uuid,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { dashboardAdmins } from "./dashboard-admins-schema.js";
import { reports } from "./reports-schema.js";

export const auditAction = pgEnum("audit_action", [
  "warn",
  "restrict",
  "ban",
  "dismiss",
]);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardAdminId: uuid("dashboard_admin_id")
      .references(() => dashboardAdmins.id, { onDelete: "set null" }),
    reportId: uuid("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    action: auditAction("action").notNull(),
    actedAt: timestamp("acted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_admin_idx").on(table.dashboardAdminId),
    index("audit_log_report_idx").on(table.reportId),
    index("audit_log_acted_at_idx").on(table.actedAt),
  ],
);