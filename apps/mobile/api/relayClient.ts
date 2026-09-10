// api/relayClient.ts
//
// DB-2.2 — API layer for per-device message relay.
//
// The backend stores one message_relay row per recipient device.
// To deliver a message to a user with N active devices, the sender
// fans out N rows. Each device receives its copy via /poll and
// marks it delivered via /ack.
//
// SECURITY: JWT from SecureStore in the Authorization header.

import * as SecureStore from 'expo-secure-store';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const RELAY_BASE = `${BACKEND_URL}/api/v1/relay`;

async function apiAuthPost<T>(base: string, path: string, body: unknown): Promise<T> {
  const token = await SecureStore.getItemAsync('accessToken');

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : JSON.stringify({}),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    (error as any).status = res.status;
    (error as any).body = data;
    throw error;
  }

  return data as T;
}

// ── Types ──

export type RelaySendParams =
  | { recipientUserId: string; ciphertext: string; messageType?: string }
  | { recipientDeviceId: string; ciphertext: string; messageType?: string; recipientGroupId?: string };

export type RelaySendResult = {
  success: true;
  count: number;
  rows: Array<{ id: string; recipientDeviceId: string | null }>;
};

export type RelayMessage = {
  id: string;
  senderDeviceId: string;
  ciphertext: string | null;
  messageType: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
};

export type RelayPollResult = { messages: RelayMessage[] };
export type RelayAckResult = { success: true; messageId: string; deliveredAt: string };

export const relayClient = {
  async send(params: RelaySendParams): Promise<RelaySendResult> {
    return apiAuthPost<RelaySendResult>(RELAY_BASE, '/send', params);
  },

  /** Poll undelivered messages for the authenticated device. */
  async poll(deviceId?: string): Promise<RelayPollResult> {
    return apiAuthPost<RelayPollResult>(RELAY_BASE, '/poll', { deviceId });
  },

  /** Mark a relayed message as delivered. */
  async ack(messageId: string): Promise<RelayAckResult> {
    return apiAuthPost<RelayAckResult>(RELAY_BASE, '/ack', { messageId });
  },
};