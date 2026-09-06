/**
 * DB-2.4 — Reports routes.
 *
 * File a report against a phone number, list your own reports, and
 * get a single report with its bounded evidence snapshot.
 *
 * Reports are keyed by phone_hash (never the raw phone number / userId)
 * so they survive account delete-and-recreate. The bounded evidence
 * snapshot (last 20 messages OR last 7 days, whichever smaller) is
 * enforced in the DB by triggers from migration 005.
 */

import { Router, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { reports } from "../db/reports-schema.js";
import { reportEvidence } from "../db/report-evidence-schema.js";
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

// ──────────────────────────────────────────────────
// POST /reports/file
// Body: {
//   reportedPhone: "+1234567890",   // E.164 phone number of the offender
//   reason?: string,                // optional short summary
//   messages?: Array<{
//     content: string;
//     createdAt?: string;           // ISO timestamp of the message
//   }>
// }
// ──────────────────────────────────────────────────
router.post("/file", async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;
    const { reportedPhone, reason, messages } = req.body as {
      reportedPhone?: string;
      reason?: string;
      messages?: Array<{ content: string; createdAt?: string }>;
    };

    if (!reportedPhone || typeof reportedPhone !== "string" || !isValidE164(reportedPhone)) {
      res.status(400).json({ error: "reportedPhone (E.164) is required" });
      return;
    }

    const db = getDb();
    const selfHash = await resolveSelfPhoneHash(authUserId);
    if (!selfHash) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const reportedHash = phoneHash(reportedPhone);
    if (reportedHash === selfHash) {
      res.status(400).json({ error: "CANNOT_REPORT_SELF" });
      return;
    }

    // Create the report, then attach evidence rows (if any).
    const reportId = await db.transaction(async (tx) => {
      const [report] = await tx
        .insert(reports)
        .values({
          reporterPhoneHash: selfHash,
          reportedPhoneHash: reportedHash,
          status: "pending",
        })
        .returning({ id: reports.id });

      if (!report) throw new Error("REPORT_CREATE_FAILED");

      if (messages && Array.isArray(messages) && messages.length > 0) {
        const now = new Date();
        // Cap evidence to 20 rows here as a safety net — the DB trigger
        // also enforces the 20-message cap.
        const bounded = messages.slice(0, 20);
        for (const m of bounded) {
          const content = typeof m.content === "string" ? m.content.slice(0, 5000) : "";
          if (!content) continue;
          await tx.insert(reportEvidence).values({
            reportId: report.id,
            messageContent: content,
            messageCreatedAt: m.createdAt ? new Date(m.createdAt) : now,
            capturedAt: now,
          });
        }
      }

      return report.id;
    });

    res.json({ success: true, reportId });
  } catch (err) {
    console.error("POST /reports/file error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /reports/list
// Returns all reports filed by the authenticated user.
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
      .select({
        id: reports.id,
        reportedPhoneHash: reports.reportedPhoneHash,
        status: reports.status,
        createdAt: reports.createdAt,
        reviewedAt: reports.reviewedAt,
        actionedAt: reports.actionedAt,
      })
      .from(reports)
      .where(eq(reports.reporterPhoneHash, selfHash))
      .orderBy(desc(reports.createdAt));

    res.json({ reports: rows });
  } catch (err) {
    console.error("POST /reports/list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────
// POST /reports/get
// Body: { reportId: string }
// Returns the report + its bounded evidence snapshot.
// ──────────────────────────────────────────────────
router.post("/get", async (req: Request, res: Response) => {
  try {
    const authUserId = res.locals.auth!.sub;
    const { reportId } = req.body as { reportId?: string };

    if (typeof reportId !== "string") {
      res.status(400).json({ error: "reportId is required" });
      return;
    }

    const db = getDb();
    const selfHash = await resolveSelfPhoneHash(authUserId);
    if (!selfHash) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    // Only the reporter can read their own report.
    if (!report || report.reporterPhoneHash !== selfHash) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    // Evidence rows are one-per-message; the bounded jsonb snapshot is
    // on the reports row itself (populated by DB triggers).
    res.json({
      id: report.id,
      reportedPhoneHash: report.reportedPhoneHash,
      status: report.status,
      createdAt: report.createdAt,
      reviewedAt: report.reviewedAt,
      actionedAt: report.actionedAt,
      decryptedMessageSnapshot: report.decryptedMessageSnapshot,
    });
  } catch (err) {
    console.error("POST /reports/get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;