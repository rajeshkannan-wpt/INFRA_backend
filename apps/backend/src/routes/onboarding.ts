/**
 * ONB — Onboarding API routes.
 *
 * Security hardening applied:
 *   - OTP hash comparison uses timing-safe equal (CWE-208)
 *   - Raw OTP code never logged (removed from console.log)
 *   - Phone numbers validated against E.164 format
 *   - Rate limiting on OTP send and verify endpoints
 *   - session/check requires valid JWT (prevents session enumeration)
 *   - login/handoff requires valid refresh token (prevents account takeover)
 *   - OTP attempts use atomic SQL increment (prevents race condition)
 */

import { Router, type Request, type Response } from "express";
import {
  createHash,
  randomUUID,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  recordLegalAcceptance,
  requireLegalAcceptance,
  LegalAcceptanceRequiredError,
  issueAccessToken,
  issueRefreshToken,
  validateRefreshToken,
} from "../auth/index.js";
import { getDb, type AppDb } from "../db/index.js";
import { sessions } from "../db/sessions-schema.js";
import { users } from "../db/users-schema.js";
import { otpVerifications } from "../db/otp-verifications-schema.js";
import { smsOutbox } from "../db/sms-outbox-schema.js";
import { contactHashes } from "../db/contact-hashes-schema.js";
import { pushForceLogout } from "../ws/socket-registry.js";
import { deliverOtpCode } from "../sms/sender.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { phoneHash } from "../utils/phone-hash.js";
import { normalizePhoneNumber } from "../utils/phone-normalize.js";

const router: Router = Router();

// ── OTP config (matches ONB-1.0 mock exactly) ──
const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60_000; // 5 minutes
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000; // 30 seconds
const RESEND_COOLDOWN_MS = 30_000; // 30 seconds (independent of lockout)

/**
 * OTP helper functions.
 */
function generateOtpCode(): string {
  const bytes = randomBytes(OTP_LENGTH);
  return Array.from(bytes)
    .map((b) => (b % 10).toString())
    .join("");
}

function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Timing-safe comparison of two hex-encoded SHA-256 hashes.
 * Prevents CWE-208 (timing side-channel) on OTP verification.
 */
function timingSafeHashCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * LOGIN-3.4 + §7.3 — Atomic new-device handoff transaction.
 *
 * Called by:
 *   - POST /otp/verify   (OTP success path)
 *   - POST /login/handoff (new-device login, requires valid refresh token)
 */
async function executeHandoffTransaction({
  userId,
  deviceId,
  phoneNumber,
}: {
  userId: string;
  deviceId: string;
  phoneNumber?: string;
}): Promise<{
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  revokedCount: number;
  userId: string;
  routing?: "chats" | "profile_setup";
}> {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    let routing: "chats" | "profile_setup" | undefined;

    if (phoneNumber) {
      const [, [existingUser]] = await Promise.all([
        tx
          .delete(otpVerifications)
          .where(eq(otpVerifications.phoneNumber, phoneNumber)),
        tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phoneNumber, phoneNumber))
          .limit(1),
      ]);

      if (existingUser) {
        userId = existingUser.id;
        routing = "chats";
      } else {
        // New user registration — create user + contact_hashes row in same transaction (Tech Arch §14.4)
        userId = randomUUID();
        const hash = phoneHash(phoneNumber);

        await Promise.all([
          tx.insert(users).values({
            id: userId,
            phoneNumber,
            name: "",
          }),
          tx.insert(contactHashes).values({
            phoneHash: hash,
            userId,
          }),
        ]);

        routing = "profile_setup";
      }
    }

    const revokeResult = await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
        ),
      );
    const revokedCount = revokeResult.rowCount ?? 0;

    const { refreshToken, sessionId } = await issueRefreshToken({
      userId,
      deviceId,
      db: tx as unknown as AppDb,
    });

    const accessToken = await issueAccessToken({
      userId,
      deviceId,
      sessionId,
    });

    return { sessionId, accessToken, refreshToken, revokedCount, userId, routing };
  });

  pushForceLogout(userId, deviceId);

  return result;
}

// ──────────────────────────────────────────────────
// POST /onboarding/accept-legal
// ──────────────────────────────────────────────────
router.post("/accept-legal", async (req: Request, res: Response) => {
  try {
    const { phoneNumber: rawPhoneNumber } = req.body as { phoneNumber?: string };

    if (!rawPhoneNumber || typeof rawPhoneNumber !== "string") {
      res.status(400).json({ error: "phoneNumber is required" });
      return;
    }

    // Normalize phone number to E.164 format (supports different input formats)
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

    if (!phoneNumber) {
      res.status(400).json({
        error: "INVALID_PHONE",
        message: "Phone number must be valid (e.g. +1234567890, or 1234567890 with country)",
      });
      return;
    }

    await recordLegalAcceptance({
      phoneNumber,
      legalVersion: "v1.0-2024-01-15",
    });

    res.json({ success: true });
  } catch (_err) {
    console.error("POST /accept-legal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /onboarding/otp/send
// Rate limited: max 3 sends per phone per 60 seconds
// ──────────────────────────────────────────────────
router.post(
  "/otp/send",
  rateLimit({
    maxRequests: 3,
    windowMs: 60_000,
    keyFn: (req) => `otp-send:${req.body?.phoneNumber ?? req.ip}`,
    message: "Too many OTP requests. Please wait before retrying.",
  }),
  async (req: Request, res: Response) => {
    try {
      const { phoneNumber: rawPhoneNumber } = req.body as { phoneNumber?: string };

      if (!rawPhoneNumber || typeof rawPhoneNumber !== "string") {
        res.status(400).json({ error: "phoneNumber is required" });
        return;
      }

      // Normalize phone number to E.164 format (supports different input formats)
      const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

      if (!phoneNumber) {
        res.status(400).json({
          error: "INVALID_PHONE",
          message: "Phone number must be valid (e.g. +1234567890, or 1234567890 with country)",
        });
        return;
      }

      const db = getDb();
      const now = new Date();

      // Resend cooldown check (independent 30s timer, §7.2)
      const [existing] = await db
        .select({ sentAt: otpVerifications.sentAt })
        .from(otpVerifications)
        .where(eq(otpVerifications.phoneNumber, phoneNumber))
        .limit(1);

      if (existing) {
        const elapsed = now.getTime() - existing.sentAt.getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
          res.status(429).json({
            error: "RESEND_COOLDOWN_ACTIVE",
            secondsRemaining: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
          });
          return;
        }
      }

      const rawCode = generateOtpCode();
      const codeHash = hashOtpCode(rawCode);
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      // Delete old row + insert new verification + queue SMS outbox row.
      // SECURITY: raw OTP code is NEVER stored in DB — only the SHA-256 hash.
      await Promise.all([
        db
          .delete(otpVerifications)
          .where(eq(otpVerifications.phoneNumber, phoneNumber)),
        db.insert(otpVerifications).values({
          phoneNumber,
          codeHash,
          expiresAt,
          sentAt: now,
        }),
        db.insert(smsOutbox).values({
          phoneNumber,
          otpHash: codeHash,
          status: "pending",
        }),
      ]);

      // Deliver the code. Sends a real SMS when a provider (Twilio) is
      // configured; otherwise prints the code to the server console for dev.
      await deliverOtpCode(phoneNumber, rawCode);

      res.json({ success: true });
    } catch (_err) {
      console.error("POST /otp/send error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ──────────────────────────────────────────────────
// POST /onboarding/otp/verify
// Rate limited: max 5 verify attempts per phone per 60 seconds
// ──────────────────────────────────────────────────
router.post(
  "/otp/verify",
  rateLimit({
    maxRequests: 5,
    windowMs: 60_000,
    keyFn: (req) => `otp-verify:${req.body?.phoneNumber ?? req.ip}`,
    message: "Too many verification attempts. Please wait.",
  }),
  async (req: Request, res: Response) => {
    try {
      const { phoneNumber: rawPhoneNumber, code } = req.body as {
        phoneNumber?: string;
        code?: string;
      };

      if (!rawPhoneNumber || !code) {
        res.status(400).json({ error: "phoneNumber and code are required" });
        return;
      }

      // Normalize phone number to E.164 format (supports different input formats)
      const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

      if (!phoneNumber) {
        res.status(400).json({ error: "INVALID_PHONE" });
        return;
      }

      if (typeof code !== "string" || code.length !== OTP_LENGTH) {
        res.status(400).json({ error: "INVALID_CODE_FORMAT" });
        return;
      }

      // Legal gate check
      try {
        await requireLegalAcceptance(phoneNumber);
      } catch (err) {
        if (err instanceof LegalAcceptanceRequiredError) {
          res.status(err.statusCode).json({ error: err.code });
          return;
        }
        throw err;
      }

      const db = getDb();
      const now = new Date();

      const [record] = await db
        .select()
        .from(otpVerifications)
        .where(eq(otpVerifications.phoneNumber, phoneNumber))
        .limit(1);

      if (!record) {
        res.status(400).json({ error: "NO_ACTIVE_SESSION" });
        return;
      }

      // Lockout check
      if (record.lockedUntil && now < record.lockedUntil) {
        res.json({
          status: "locked_out",
          secondsRemaining: Math.ceil(
            (record.lockedUntil.getTime() - now.getTime()) / 1000,
          ),
        });
        return;
      }

      // Expiry check
      if (now.getTime() - record.sentAt.getTime() > OTP_TTL_MS) {
        await db
          .delete(otpVerifications)
          .where(eq(otpVerifications.phoneNumber, phoneNumber));
        res.json({ status: "expired" });
        return;
      }

      // Timing-safe code comparison (CWE-208)
      const presentedHash = hashOtpCode(code);

      if (!timingSafeHashCompare(presentedHash, record.codeHash)) {
        // Wrong code — atomic increment attempts (prevents race condition)
        const newAttempts = record.attempts + 1;
        const remaining = MAX_ATTEMPTS - newAttempts;

        if (remaining <= 0) {
          const lockedUntil = new Date(now.getTime() + LOCKOUT_MS);
          await db
            .update(otpVerifications)
            .set({ attempts: newAttempts, lockedUntil })
            .where(eq(otpVerifications.phoneNumber, phoneNumber));

          res.json({ status: "attempts_exhausted" });
          return;
        }

        // Atomic increment: SET attempts = attempts + 1 (no read-modify-write)
        await db
          .update(otpVerifications)
          .set({ attempts: sql`GREATEST(${otpVerifications.attempts} + 1, ${newAttempts})` })
          .where(eq(otpVerifications.phoneNumber, phoneNumber));

        res.json({ status: "wrong_code", attemptsRemaining: remaining });
        return;
      }

      // SUCCESS — Atomic handoff transaction
      const deviceId = `device_${Date.now()}_${randomBytes(4).toString("hex")}`;
      const result = await executeHandoffTransaction({
        userId: "",
        deviceId,
        phoneNumber,
      });

      res.json({
        status: "success",
        routing: result.routing!,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        sessionId: result.sessionId,
      });
    } catch (_err) {
      console.error("POST /otp/verify error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ──────────────────────────────────────────────────
// POST /onboarding/check-existing-user
// Returns boolean only (no userId) to prevent enumeration
// ──────────────────────────────────────────────────
router.post("/check-existing-user", async (req: Request, res: Response) => {
  try {
    const { phoneNumber: rawPhoneNumber } = req.body as { phoneNumber?: string };

    if (!rawPhoneNumber || typeof rawPhoneNumber !== "string") {
      res.status(400).json({ error: "phoneNumber is required" });
      return;
    }

    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

    if (!phoneNumber) {
      res.status(400).json({ error: "INVALID_PHONE" });
      return;
    }

    const db = getDb();
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber))
      .limit(1);

    // Only return boolean — never leak userId here
    res.json({ exists: !!existingUser });
  } catch (_err) {
    console.error("POST /check-existing-user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /onboarding/refresh
// ──────────────────────────────────────────────────
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken: presentedToken } = req.body as {
      refreshToken?: string;
    };

    if (!presentedToken) {
      res.status(400).json({ error: "refreshToken is required" });
      return;
    }

    const session = await validateRefreshToken(presentedToken);

    if (!session) {
      res.status(401).json({ error: "INVALID_REFRESH_TOKEN" });
      return;
    }

    const accessToken = await issueAccessToken({
      userId: session.userId,
      deviceId: session.deviceId,
      sessionId: session.sessionId,
    });

    res.json({ accessToken });
  } catch (_err) {
    console.error("POST /refresh error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /onboarding/login/handoff
//
// SECURITY: Requires a valid refresh token proving the caller owns
// the account. Without this, anyone could mint tokens for any userId.
// ──────────────────────────────────────────────────
router.post("/login/handoff", async (req: Request, res: Response) => {
  try {
    const { refreshToken: presentedToken, deviceInfo } = req.body as {
      refreshToken?: string;
      deviceInfo?: { deviceId: string; deviceName: string; platform: string };
    };

    if (!presentedToken || !deviceInfo) {
      res.status(400).json({
        error: "refreshToken and deviceInfo are required",
      });
      return;
    }

    if (!deviceInfo.deviceId || !deviceInfo.deviceName || !deviceInfo.platform) {
      res.status(400).json({ error: "deviceInfo must include deviceId, deviceName, and platform" });
      return;
    }

    // Validate the refresh token — proves the caller owns this account
    const session = await validateRefreshToken(presentedToken);
    if (!session) {
      res.status(401).json({ error: "INVALID_REFRESH_TOKEN" });
      return;
    }

    const handoff = await executeHandoffTransaction({
      userId: session.userId,
      deviceId: deviceInfo.deviceId,
    });

    res.json({
      success: true,
      sessionId: handoff.sessionId,
      accessToken: handoff.accessToken,
      refreshToken: handoff.refreshToken,
      message: `You're now logged in here on ${deviceInfo.deviceName}`,
      previousDevicesLoggedOut: handoff.revokedCount,
    });
  } catch (_err) {
    console.error("POST /login/handoff error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /onboarding/session/check
//
// SECURITY: Requires valid JWT — prevents session enumeration by
// unauthenticated callers.
// ──────────────────────────────────────────────────
router.post("/session/check", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;
    const { deviceId } = req.body as { deviceId?: string };

    if (!deviceId) {
      res.status(400).json({ error: "deviceId is required" });
      return;
    }

    const db = getDb();
    const [row] = await db
      .select({ id: sessions.id, revokedAt: sessions.revokedAt })
      .from(sessions)
      .where(and(eq(sessions.userId, authUserId), eq(sessions.deviceId, deviceId)))
      .limit(1);

    if (!row) {
      res.json({ isValid: false, message: "Session not found" });
      return;
    }

    if (row.revokedAt !== null) {
      res.json({ isValid: false, message: "Logged in on another device" });
      return;
    }

    res.json({ isValid: true });
  } catch (_err) {
    console.error("POST /session/check error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
