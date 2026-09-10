/**
 * DB-2.2 — Message relay table.
 *
 * Per-device message relay: one row per recipient device. A message
 * to a user with N devices creates N rows, one per recipient_device_id.
 *
 * ciphertext is stored as bytea (never plaintext). Integer size_bytes
 * holds the ciphertext length and must be >= 0. recipient_device_id is
 * NOT NULL and every row also sets exactly one of recipient_user_id /
 * recipient_group_id — the user-XOR-group rule enforced by the
 * message_relay_recipient_exactly_one CHECK constraint.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  customType,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { devices } from "./devices-schema.js";
import { users } from "./users-schema.js";
import { groups } from "./groups-schema.js";

/**
 * message_type enum, matching the live message_type_enum type and the
 * values verified in the DB-2.2-V evidence (migration 006).
 */
export const messageTypeEnum = pgEnum("message_type_enum", [
  "text",
  "image",
  "video",
  "audio",
  "file",
  "system",
]);

/** bytea column: stores binary ciphertext as a Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value;
  },
});

export const messageRelay = pgTable(
  "message_relay",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderDeviceId: uuid("sender_device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    recipientDeviceId: uuid("recipient_device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    recipientGroupId: uuid("recipient_group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    ciphertext: bytea("ciphertext").notNull(),
    messageType: messageTypeEnum("message_type").notNull().default("text"),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    replyToId: uuid("reply_to_id"),
    voiceSegmentGroupId: uuid("voice_segment_group_id"),
  },
  (table) => [
    index("idx_message_relay_recipient_user").on(table.recipientUserId),
    index("idx_message_relay_recipient_device").on(table.recipientDeviceId),
    index("idx_message_relay_recipient_group").on(table.recipientGroupId),
    index("idx_message_relay_expires").on(table.expiresAt),
    index("idx_message_relay_created").on(table.createdAt),
  ],
);