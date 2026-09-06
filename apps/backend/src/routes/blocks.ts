/**
 * DB-2.4 — Blocks routes.
 *
 * Lives-user feature: block another user so they cannot message you.
 * All operation are keyed by phone_hash (not user_id) so a block
 * survives an account delete-and-recreate on the same number.
 *
 * All routes require a valid JWT. The caller's phone hash is derived
 * from the authenticated user's phone number (never from req.body).
 */

import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { blocks } from "../db/blocks-schema.js";
import { users } from "../db/users-schema.js";
import { requireAuth } from "../middleware/auth.js";
import { isValidE164 } from "../middleware/validation.js";
import { phoneHash } from "../utils/phone-hash.js";

const router: Router = Router();

router.use(requireAuth);

/** Resolve the authenticated user's phone hash from their user row. */
async function resolveSelfPhoneHash(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ phoneNumber: users.phoneNumber })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1);
  return row ? phoneHash(row.phoneNumber) : null;
}

/** Resolve a hashed phone number from an E.164 phone number in the body. */
function phoneHashFromBody(phone: unknown): { ok: true; hash: string } | { ok: false; error: string } {
  if (typeof phone !== "string" || !isValidE164(phone)) {
    return { ok: false, error: "blockedPhoneHash (E.164 phone number) is required" };
  }
  return { ok: true, hash: phoneHash(phone) };
}

// ──────────────────────────────────────────────────
// POST /blocks/block
// Body: { blockedPhone: "+1234567890" } (E.164)
// ──────────────────────────────────────────────────
router.post("/block", async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;
    const { blockedPhone } = req.body as { blockedPhone?: string };

    if (!blockedPhone || typeof blockedPhone !== "string" || !isValidE164(blockedPhone)) {
      res.status(400).json({ error: "blockedPhone (E.164) is required" });
      return;
    }

    const db = getDb();
    const selfHash = await resolveSelfPhoneHash(authUserId);
    if (!selfHash) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const blockedHash = phoneHash(blockedPhone);
    if (blockedHash === selfHash) {
      res.status(400).json({ error: "CANNOT_BLOCK_SELF" });
      return;
    }

    // Upsert — blocking twice is idempotent.
    await db
      .insert(blocks)
      .values({
        blockerPhoneHash: selfHash,
        blockedPhoneHash: blockedHash,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    res.json({ success: true, blockedPhoneHash: blockedHash });
  } catch (err) {
    console.error("POST /blocks/block error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /blocks/unblock
// Body: { blockedPhone: "+1234567890" } (E.164)  — OR —
//       { blockedPhoneHash: "<hash>" } (raw hash from listBlocked)
// This accepts either a raw E.164 phone or an already-hashed value so
// that the mobile client can unblock an entry returned by /list
// (which only exposes phone hashes).
// ──────────────────────────────────────────────────
router.post("/unblock", async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;
    const body = req.body as { blockedPhone?: string; blockedPhoneHash?: string };

    const selfHash = await resolveSelfPhoneHash(authUserId);
    if (!selfHash) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const db = getDb();

    let blockedHash: string;
    if (typeof body.blockedPhoneHash === "string" && body.blockedPhoneHash.length > 0) {
      // Raw hash provided (from /list) — use directly.
      blockedHash = body.blockedPhoneHash;
    } else if (
      typeof body.blockedPhone === "string" &&
      body.blockedPhone.length > 0 &&
      isValidE164(body.blockedPhone)
    ) {
      blockedHash = phoneHash(body.blockedPhone);
    } else {
      res.status(400).json({ error: "Provide blockedPhone (E.164) or blockedPhoneHash" });
      return;
    }

    await db
      .delete(blocks)
      .where(
        and(
          eq(blocks.blockerPhoneHash, selfHash),
          eq(blocks.blockedPhoneHash, blockedHash),
        ),
      );

    res.json({ success: true, unblockedPhoneHash: blockedHash });
  } catch (err) {
    console.error("POST /blocks/unblock error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /blocks/check
// Body: { blockedPhone: "+1234567890" }
// Returns: { isBlocked: boolean }
// ──────────────────────────────────────────────────
router.post("/check", async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;
    const { blockedPhone } = req.body as { blockedPhone?: string };

    if (!blockedPhone || typeof blockedPhone !== "string" || !isValidE164(blockedPhone)) {
      res.status(400).json({ error: "blockedPhone (E.164) is required" });
      return;
    }

    const db = getDb();
    const selfHash = await resolveSelfPhoneHash(authUserId);
    if (!selfHash) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const blockedHash = phoneHash(blockedPhone);

    const [row] = await db
      .select({ blockedPhoneHash: blocks.blockedPhoneHash })
      .from(blocks)
      .where(
        and(
          eq(blocks.blockerPhoneHash, selfHash),
          eq(blocks.blockedPhoneHash, blockedHash),
        ),
      )
      .limit(1);

    res.json({ isBlocked: !!row });
  } catch (err) {
    console.error("POST /blocks/check error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /blocks/list
// Returns: { blockedPhoneHashes: string[] }
// ──────────────────────────────────────────────────
router.post("/list", async (_req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;
    const db = getDb();
    const selfHash = await resolveSelfPhoneHash(authUserId);
    if (!selfHash) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const rows = await db
      .select({ blockedPhoneHash: blocks.blockedPhoneHash })
      .from(blocks)
      .where(eq(blocks.blockerPhoneHash, selfHash));

    res.json({ blockedPhoneHashes: rows.map((r) => r.blockedPhoneHash) });
  } catch (err) {
    console.error("POST /blocks/list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;