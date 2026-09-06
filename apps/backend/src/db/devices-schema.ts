/**
 * DB-2.2 — Devices table.
 *
 * One row per registered device for a user. The message_relay
 * per-device fan-out uses this table to resolve which devices
 * should receive a message.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";

export const deviceType = pgEnum("device_type", ["phone", "web"]);
export const platformEnum = pgEnum("platform", ["android", "ios", "web"]);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    deviceType: deviceType("device_type").notNull(),
    platform: platformEnum("platform").notNull(),
    identityPublicKey: text("identity_public_key").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("devices_user_id_idx").on(table.userId),
  ],
);