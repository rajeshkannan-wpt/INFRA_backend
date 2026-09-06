/**
 * Profile routes — create / get / update.
 *
 * All routes require a valid JWT access token (requireAuth middleware).
 * The userId is derived from the token's `sub` claim — never from req.body.
 * This prevents IDOR attacks (OWASP API #1).
 */

import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { users } from "../db/users-schema.js";
import { requireAuth } from "../middleware/auth.js";
import {
  sanitizeProfileField,
  MAX_NAME_LENGTH,
  MAX_ABOUT_LENGTH,
  MAX_PHOTO_LENGTH,
} from "../middleware/validation.js";

const router: Router = Router();

// All profile routes require authentication
router.use(requireAuth);

// ──────────────────────────────────────────────────
// POST /profile/create
// ──────────────────────────────────────────────────
router.post("/create", async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;

    const { name, photo, about } = req.body as {
      name?: string;
      photo?: string;
      about?: string;
    };

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const safeName = sanitizeProfileField(name, MAX_NAME_LENGTH);
    const safePhoto = sanitizeProfileField(photo, MAX_PHOTO_LENGTH);
    const safeAbout =
      sanitizeProfileField(about, MAX_ABOUT_LENGTH) ||
      "Hey there! I'm using ONB";

    if (!safeName) {
      res.status(400).json({ error: "name cannot be empty" });
      return;
    }

    const db = getDb();
    const now = new Date();

    const [updated] = await db
      .update(users)
      .set({
        name: safeName,
        photo: safePhoto ?? null,
        about: safeAbout,
        updatedAt: now,
      })
      .where(eq(users.id, authUserId))
      .returning({
        id: users.id,
        name: users.name,
        photo: users.photo,
        about: users.about,
        phoneNumber: users.phoneNumber,
        createdAt: users.createdAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      success: true,
      userId: updated.id,
      profile: {
        id: updated.id,
        name: updated.name,
        photo: updated.photo ?? undefined,
        about: updated.about ?? "",
        phoneNumber: updated.phoneNumber,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /profile/create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /profile/get
// ──────────────────────────────────────────────────
router.post("/get", async (_req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;

    const db = getDb();
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUserId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: row.id,
      name: row.name,
      photo: row.photo ?? undefined,
      about: row.about ?? "",
      phoneNumber: row.phoneNumber,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("POST /profile/get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /profile/update
// ──────────────────────────────────────────────────
router.post("/update", async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;

    const { name, photo, about } = req.body as {
      name?: string;
      photo?: string;
      about?: string;
    };

    const db = getDb();

    // Build partial update — only set fields that were provided, sanitized.
    const fields: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) {
      const safe = sanitizeProfileField(name, MAX_NAME_LENGTH);
      if (safe) fields.name = safe;
    }
    if (photo !== undefined) {
      fields.photo = sanitizeProfileField(photo, MAX_PHOTO_LENGTH) ?? null;
    }
    if (about !== undefined) {
      fields.about = sanitizeProfileField(about, MAX_ABOUT_LENGTH) ?? "";
    }

    const [updated] = await db
      .update(users)
      .set(fields)
      .where(eq(users.id, authUserId))
      .returning({
        id: users.id,
        name: users.name,
        photo: users.photo,
        about: users.about,
        phoneNumber: users.phoneNumber,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      success: true,
      profile: {
        id: updated.id,
        name: updated.name,
        photo: updated.photo ?? undefined,
        about: updated.about ?? "",
        phoneNumber: updated.phoneNumber,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /profile/update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
