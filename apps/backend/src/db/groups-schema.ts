/**
 * DB-2.1 — Groups and group_members tables.
 *
 * Groups were previously created directly in the live Supabase database but
 * had no representation in this repo, so a fresh environment could not
 * reproduce them. This schema adds them back so the DB is reproducible from
 * code, matching Tech Arch §6.3 and the live schema exactly.
 *
 * Security note (Tech Arch §13.3): group metadata (name / icon / description)
 * is END-TO-END ENCRYPTED and stored as bytea — never plaintext text/varchar.
 * There is deliberately NO who_can_edit_info toggle: adding members and
 * editing group info are both Owner/Admin-only. who_can_send controls message
 * send permission only.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  customType,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

/** bytea column: stores encrypted group metadata (binary, never plaintext). */
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

/** Who may send messages into the group. NOT a metadata-edit toggle. */
export const whoCanSend = pgEnum("who_can_send", ["everyone", "admins_only"]);

/** Member role. Editor/metadata rights mirror this (Owner/Admin only). */
export const groupMemberRole = pgEnum("group_member_role", [
  "owner",
  "admin",
  "member",
]);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Encrypted group display name — bytea ciphertext under the Group Key. */
    encryptedName: bytea("encrypted_name").notNull(),

    /** Encrypted pointer to a Storage object — bytea, nullable. */
    encryptedIconRef: bytea("encrypted_icon_ref"),

    /** Encrypted group description — bytea, nullable. */
    encryptedDescription: bytea("encrypted_description"),

    /** Send permission. Defaults to everyone; admins_only limits senders. */
    whoCanSend: whoCanSend("who_can_send").notNull().default("everyone"),

    /** Incremented on every membership-departure event; drives Sender/Group
     *  Key rotation. Default 0 per Tech Arch §6.3. */
    senderKeyEpoch: integer("sender_key_epoch").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    // user_id is declared as uuid with no Drizzle FK — the FK to users.id
    // is enforced in SQL migration 010. This matches the devices.user_id
    // convention: the codebase models users.id as varchar(64) while the
    // live Supabase DB uses uuid, so the FK lives at the SQL layer.
    userId: uuid("user_id").notNull(),
    role: groupMemberRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Composite primary key: a user appears once per group.
    primaryKey({ columns: [table.groupId, table.userId] }),
  ],
);
