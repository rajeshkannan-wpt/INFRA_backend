/**
 * Refresh-token issuance, validation, and revocation.
 *
 * Card: "Refresh token storage/hashing + revocation check"
 *
 * Contract (Tech Arch §7.1):
 *   - Refresh token is 30 days, issued alongside the access token.
 *   - The RAW token is returned to the client ONCE; only its bcrypt
 *     hash is stored in the sessions table (DB-2.6).
 *   - A deterministic lookup key (SHA-256 prefix) is stored alongside
 *     the bcrypt hash to allow fast DB index lookups, since bcrypt
 *     hashes are non-deterministic due to random salt.
 *   - On every refresh attempt the lookup key is used to find the row,
 *     then bcrypt.compare verifies the token, and `revoked_at` is
 *     checked — if non-null the session is dead.
 *   - This is the mechanism that makes force-logout work for devices
 *     that aren't currently connected.
 */

import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import { eq, and, isNull } from "drizzle-orm";
import { getDb, type AppDb } from "../db/index.js";
import { sessions } from "../db/sessions-schema.js";

const REFRESH_TOKEN_BYTES = 48; // 384 bits — plenty of entropy
const REFRESH_TOKEN_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

function lookupKey(raw: string): string {
  // First 32 hex chars of SHA-256 — deterministic, used for DB index lookup.
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function expiresAt30Days(): Date {
  const now = new Date();
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type IssueRefreshTokenResult = {
  /** The raw refresh token — return this to the client, then forget it. */
  refreshToken: string;
  /** Session ID — store this in the JWT `sid` claim. */
  sessionId: string;
};

/**
 * Issue a new refresh token.
 *
 * 1. Generate a cryptographically random token.
 * 2. Compute a deterministic lookup key (SHA-256 prefix) for DB queries.
 * 3. Hash the token with bcrypt (12 rounds) for storage.
 * 4. Insert both hashes (+ metadata) into the sessions table.
 * 5. Return the raw token to the caller (who sends it to the client).
 *
 * The raw token is NEVER written to the database.
 */
export async function issueRefreshToken({
  userId,
  deviceId,
  db: dbParam,
}: {
  userId: string;
  deviceId: string;
  db?: AppDb;
}): Promise<IssueRefreshTokenResult> {
  const db = dbParam ?? getDb();

  const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  const tokenLookup = lookupKey(rawToken);
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);

  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      deviceId,
      tokenLookup,
      refreshTokenHash: tokenHash,
      refreshTokenExpiresAt: expiresAt30Days(),
    })
    .returning({ id: sessions.id });

  if (!row) {
    throw new Error("Failed to create session — INSERT RETURNING returned no rows");
  }

  return {
    refreshToken: rawToken,
    sessionId: row.id,
  };
}

export type ValidatedSession = {
  sessionId: string;
  userId: string;
  deviceId: string;
};

/**
 * Validate a refresh token.
 *
 * 1. Compute the deterministic lookup key from the presented token.
 * 2. Look up the session by lookup key (fast DB index hit).
 * 3. Verify the token against the stored bcrypt hash.
 * 4. Reject if not found, wrong token, revoked, or expired.
 *
 * Returns the session metadata on success — enough to mint a new
 * access token without an extra DB round-trip.
 */
export async function validateRefreshToken(
  rawToken: string,
): Promise<ValidatedSession | null> {
  const db = getDb();
  const tokenLookup = lookupKey(rawToken);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      deviceId: sessions.deviceId,
      refreshTokenHash: sessions.refreshTokenHash,
      revokedAt: sessions.revokedAt,
      expiresAt: sessions.refreshTokenExpiresAt,
    })
    .from(sessions)
    .where(eq(sessions.tokenLookup, tokenLookup))
    .limit(1);

  if (!row) return null;

  // Verify the bcrypt hash — lookup key alone is not sufficient.
  const valid = await bcrypt.compare(rawToken, row.refreshTokenHash);
  if (!valid) return null;

  // Revoked — session was force-logged-out.
  if (row.revokedAt !== null) return null;

  // Expired — 30-day window passed.
  if (row.expiresAt < now) return null;

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    deviceId: row.deviceId,
  };
}

/**
 * Revoke a session by setting `revoked_at` to now.
 *
 * After this call, any refresh attempt with the corresponding token
 * will be rejected by `validateRefreshToken`.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Revoke ALL sessions for a user (force-logout everywhere).
 *
 * Used by ONB-1.7 (new-device login handoff) and by the admin
 * kill-switch.
 */
export async function revokeAllUserSessions(userId: string, db?: AppDb): Promise<number> {
  const conn = db ?? getDb();

  const result = await conn
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt), // only revoke active sessions
      ),
    );

  return result.rowCount ?? 0;
}
