import type { UserId, DeviceId } from "@wpt/shared";

/**
 * LOGIN-3.1 — JWT access token payload.
 *
 * Contains enough claims to identify the user and device without a
 * database lookup on every request (Tech Arch §7.1).
 *
 * The `sid` (session ID) ties the token to a row in the sessions
 * table (DB-2.6) so that a real-time kill-switch can invalidate it
 * server-side; if the session row is deleted or revoked, any token
 * bearing that `sid` is effectively dead even before its `exp`.
 */
export interface AccessTokenPayload {
  /** Subject — the user who owns this token. */
  sub: UserId;
  /** The device that was authenticated. */
  deviceId: DeviceId;
  /** Session ID — links to DB-2.6 sessions table for revocation. */
  sid: string;
  /** Issued-at (JWT-registered claim, set automatically by jose). */
  iat: number;
  /** Expiry — exactly 1 hour from issuance (§7.1). */
  exp: number;
  /** Issuer — the backend service. */
  iss: string;
}

export type IssueAccessTokenParams = {
  userId: UserId;
  deviceId: DeviceId;
  sessionId: string;
};
