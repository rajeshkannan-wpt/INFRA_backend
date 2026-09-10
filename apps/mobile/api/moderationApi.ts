// api/moderationApi.ts
//
// DB-2.4 / DB-2.5 — API layer for user blocks and reports.
//
// SECURITY: All authenticated endpoints receive the JWT via the
// Authorization header (read from SecureStore). userId is derived
// from the token server-side — never sent in request bodies. This
// matches the backend: blocks and reports are keyed by phone_hash
// (derived from E.164 phone numbers), so the client only ever sends
// the raw E.164 phone number and the backend hashes it.

import * as SecureStore from 'expo-secure-store';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const BLOCKS_BASE = `${BACKEND_URL}/api/v1/blocks`;
const REPORTS_BASE = `${BACKEND_URL}/api/v1/reports`;

// ── Authenticated POST ──
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

export type BlockParams = { blockedPhone: string };
export type UnblockParams = { blockedPhone?: string; blockedPhoneHash?: string };
export type BlockResult = { success: true; blockedPhoneHash: string };
export type UnblockResult = { success: true; unblockedPhoneHash: string };
export type CheckBlockedParams = { blockedPhone: string };
export type CheckBlockedResult = { isBlocked: boolean };
export type ListBlockedResult = { blockedPhoneHashes: string[] };

export type MessageEvidence = { content: string; createdAt?: string };
export type FileReportParams = {
  reportedPhone: string;
  reason?: string;
  messages?: MessageEvidence[];
};
export type FileReportResult = { success: true; reportId: string };
export type Report = {
  id: string;
  reportedPhoneHash: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  createdAt: string;
  reviewedAt: string | null;
  actionedAt: string | null;
  decryptedMessageSnapshot?: unknown[] | null;
};
export type ListReportsResult = { reports: Array<Omit<Report, 'decryptedMessageSnapshot'>> };
export type GetReportResult = Report;

export const moderationApi = {
  // ── Blocks ──
  async block(blockedPhone: string): Promise<BlockResult> {
    return apiAuthPost<BlockResult>(BLOCKS_BASE, '/block', { blockedPhone });
  },

  async unblock(params: UnblockParams): Promise<UnblockResult> {
    return apiAuthPost<UnblockResult>(BLOCKS_BASE, '/unblock', params);
  },

  async isBlocked(blockedPhone: string): Promise<CheckBlockedResult> {
    return apiAuthPost<CheckBlockedResult>(BLOCKS_BASE, '/check', { blockedPhone });
  },

  async listBlocked(): Promise<ListBlockedResult> {
    return apiAuthPost<ListBlockedResult>(BLOCKS_BASE, '/list', {});
  },

  // ── Reports ──
  async fileReport(params: FileReportParams): Promise<FileReportResult> {
    return apiAuthPost<FileReportResult>(REPORTS_BASE, '/file', params);
  },

  async listReports(): Promise<ListReportsResult> {
    return apiAuthPost<ListReportsResult>(REPORTS_BASE, '/list', {});
  },

  async getReport(reportId: string): Promise<GetReportResult> {
    return apiAuthPost<GetReportResult>(REPORTS_BASE, '/get', { reportId });
  },
};