/**
 * TODO(spec): §5 says this module should "mirror Section 6's data model."
 * I only have page 6 (§5) of WPT_Technical_Architecture_Document_v1.0.pdf —
 * Section 6 itself hasn't been shared yet. The shapes below are a
 * placeholder inferred from context (messaging app, X3DH/Double Ratchet,
 * groups) so downstream packages have something to compile against.
 * Replace this file's contents with the real Section 6 model before
 * anything here is treated as authoritative.
 */

export type UserId = string;
export type DeviceId = string;
export type ConversationId = string;
export type MessageId = string;

export interface User {
  id: UserId;
  displayName: string;
  createdAt: string; // ISO 8601
}

export interface Device {
  id: DeviceId;
  userId: UserId;
  registrationId: number;
  identityPublicKey: string; // base64
  createdAt: string;
}

export type ConversationKind = "direct" | "group";

export interface Conversation {
  id: ConversationId;
  kind: ConversationKind;
  memberIds: UserId[];
  createdAt: string;
}

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  senderId: UserId;
  senderDeviceId: DeviceId;
  ciphertext: string; // base64, produced by @wpt/crypto
  status: MessageStatus;
  sentAt: string;
}
