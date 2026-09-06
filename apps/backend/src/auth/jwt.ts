/**
 * LOGIN-3.1 — JWT access token issuance.
 *
 * Every successful login / OTP-verify (LOGIN-3.6) and every token
 * refresh calls `issueAccessToken` to mint a short-lived Bearer
 * credential (Tech Arch §7.1).
 *
 * Token properties:
 *   Algorithm  : HS256 (symmetric, fast, adequate for short-lived tokens)
 *   Expiry     : exactly 1 hour — bounds worst-case kill-switch latency
 *   Claims     : sub (UserId), deviceId, sid (session ID for revocation)
 *   Verification: `verifyAccessToken` decodes + validates signature + exp
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { AccessTokenPayload, IssueAccessTokenParams } from "./types.js";

/** Exactly 1 hour — bounds worst-case kill-switch latency (§7.1). */
const ACCESS_TOKEN_EXPIRY = "1h";

const ISSUER = "wpt-backend";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Generate one with: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Mint a signed JWT access token.
 *
 * @returns A compact JWT string suitable for `Authorization: Bearer <token>`.
 */
export async function issueAccessToken({
  userId,
  deviceId,
  sessionId,
}: IssueAccessTokenParams): Promise<string> {
  const secret = getSecret();

  const token = await new SignJWT({
      deviceId,
      sid: sessionId,
    })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

/**
 * Verify a JWT access token and return its parsed payload.
 *
 * Validates:
 *   - Signature (HS256 against JWT_SECRET)
 *   - Expiry (`exp` claim)
 *   - Issuer (`iss` claim)
 *
 * @throws on any verification failure (expired, tampered, wrong issuer).
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const secret = getSecret();

  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
  });

  return toAccessTokenPayload(payload);
}

/**
 * Decode a JWT **without** verifying the signature.
 *
 * USE ONLY for debugging / logging. Never trust the result for
 * authorization decisions — always call `verifyAccessToken` instead.
 */
export function decodeAccessTokenUnsafe(token: string): JWTPayload {
  const [, payloadB64] = token.split(".");
  if (!payloadB64) throw new Error("Malformed JWT — no payload segment");
  return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
}

function toAccessTokenPayload(raw: JWTPayload): AccessTokenPayload {
  const sub = typeof raw.sub === "string" ? raw.sub : undefined;
  const deviceId =
    typeof raw.deviceId === "string" ? raw.deviceId : undefined;
  const sid = typeof raw.sid === "string" ? raw.sid : undefined;
  const iat = typeof raw.iat === "number" ? raw.iat : undefined;
  const exp = typeof raw.exp === "number" ? raw.exp : undefined;
  const iss = typeof raw.iss === "string" ? raw.iss : undefined;

  if (!sub || !deviceId || !sid || iat === undefined || exp === undefined || !iss) {
    throw new Error(
      "JWT payload is missing required claims (sub, deviceId, sid, iat, exp, iss)",
    );
  }

  return {
    sub,
    deviceId,
    sid,
    iat,
    exp,
    iss,
  };
}

// ─────────────────────────────────────────────────────────────
// DB-2.5 — Dashboard-admin tokens.
//
// Admins authenticate with a distinct JWT that carries an `adm`
// claim (verifying they are dashboard staff) and no deviceId/sid
// claims (they are not an end-user device session). The secret and
// issuer are the same so the sign/verify plumbing is shared, but
// the token shape is separate from the user access token.
// ─────────────────────────────────────────────────────────────

/** Issue a signed JWT for a dashboard admin. */
export async function issueAdminToken(
  adminId: string,
  expiresIn: string = "8h",
): Promise<string> {
  const secret = getSecret();

  const token = await new SignJWT({ adm: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(adminId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

  return token;
}

/** Verify an admin token. Returns the adminId (sub) on success. */
export async function verifyAdminToken(
  token: string,
): Promise<{ adminId: string }> {
  const secret = getSecret();

  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    algorithms: ["HS256"],
  });

  if (payload.adm !== "admin") {
    throw new Error("Not an admin token");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : undefined;
  if (!sub) {
    throw new Error("Admin token missing sub");
  }

  return { adminId: sub };
}
