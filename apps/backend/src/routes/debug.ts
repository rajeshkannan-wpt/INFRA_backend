/**
 * Debug routes — view all DB table data from the browser.
 *
 * Triple gate:
 *   1. DEBUG=1 env var must be set
 *   2. NODE_ENV must NOT be "production"
 *   3. Only accessible from localhost (IP check)
 *
 * Remove entirely before production deploy.
 */

import { Router, Request, Response } from "express";
import { getDb } from "../db/index.js";
import { issueAdminToken } from "../auth/jwt.js";

const router: Router = Router();

function requireDebug(req: Request, res: Response, next: Function) {
  if (process.env.DEBUG !== "1") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Only allow from localhost
  const ip = req.ip ?? req.socket.remoteAddress ?? "";
  const isLocal =
    ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLocal) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.use(requireDebug);

router.get("/tables", async (_req: Request, res: Response) => {
  try {
    const db = getDb();

    const [users, sessions, otpRows, smsOutbox, legal] = await Promise.all([
      db.query.users.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] }),
      db.query.sessions.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] }),
      db.execute("SELECT * FROM otp_verifications ORDER BY sent_at DESC LIMIT 20"),
      db.execute("SELECT * FROM sms_outbox ORDER BY created_at DESC LIMIT 20"),
      db.execute("SELECT * FROM legal_acceptances ORDER BY accepted_at DESC LIMIT 20"),
    ]);

    const data = {
      users: users.map((u) => ({
        id: u.id,
        phone: u.phoneNumber,
        name: u.name,
        photo: u.photo || null,
        about: u.about || null,
        created: u.createdAt,
        updated: u.updatedAt,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        deviceId: s.deviceId,
        revokedAt: s.revokedAt || "(active)",
        created: s.createdAt,
      })),
      otpVerifications: otpRows.rows,
      smsOutbox: smsOutbox.rows,
      legalAcceptances: legal.rows,
    };

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html><head><title>DB State</title>
<style>
  body { font-family: monospace; background: #111; color: #eee; padding: 20px; }
  h2 { color: #3FC6B8; margin-top: 30px; border-bottom: 1px solid #333; padding-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 13px; }
  th { background: #1a1a2e; color: #3FC6B8; text-align: left; padding: 8px 12px; border: 1px solid #333; }
  td { padding: 6px 12px; border: 1px solid #222; vertical-align: top; max-width: 400px; word-break: break-all; }
  tr:nth-child(even) { background: #16161e; }
  .active { color: #3FC6B8; }
  .revoked { color: #E5484D; }
  .null { color: #555; font-style: italic; }
</style></head><body>
<h1>Database State</h1>
<p style="color:#666">Auto-refresh: <a href="/api/v1/debug/tables" style="color:#3FC6B8">click to refresh</a></p>

<h2>Users (${data.users.length})</h2>
<table><tr><th>ID</th><th>Phone</th><th>Name</th><th>Photo</th><th>About</th><th>Created</th><th>Updated</th></tr>
${data.users.map((u) => `<tr><td>${u.id}</td><td>${u.phone}</td><td>${u.name || '<span class="null">(empty)</span>'}</td><td>${u.photo || '<span class="null">(none)</span>'}</td><td>${u.about || '<span class="null">(none)</span>'}</td><td>${u.created}</td><td>${u.updated}</td></tr>`).join("\n")}</table>

<h2>Sessions (${data.sessions.length})</h2>
<table><tr><th>ID</th><th>User</th><th>Device</th><th>Status</th><th>Created</th></tr>
${data.sessions.map((s) => `<tr><td>${s.id}</td><td>${s.userId}</td><td>${s.deviceId}</td><td class="${s.revokedAt === '(active)' ? 'active' : 'revoked'}">${s.revokedAt}</td><td>${s.created}</td></tr>`).join("\n")}</table>

<h2>OTP Verifications (${data.otpVerifications.length})</h2>
<table><tr><th>Phone</th><th>Code Hash (SHA-256)</th><th>Attempts</th><th>Locked Until</th><th>Expires</th><th>Sent</th></tr>
${data.otpVerifications.map((r) => `<tr><td>${r.phone_number}</td><td style="font-size:11px">${r.code_hash}</td><td>${r.attempts}</td><td>${r.locked_until || '<span class="null">null</span>'}</td><td>${r.expires_at}</td><td>${r.sent_at}</td></tr>`).join("\n")}</table>

<h2>SMS Outbox (${data.smsOutbox.length})</h2>
<table><tr><th>Phone</th><th>OTP Hash (SHA-256)</th><th>Status</th><th>Created</th></tr>
${data.smsOutbox.map((r) => `<tr><td>${r.phone_number}</td><td style="font-size:11px">${r.otp_hash}</td><td>${r.status}</td><td>${r.created_at}</td></tr>`).join("\n")}</table>

<h2>Legal Acceptances (${data.legalAcceptances.length})</h2>
<table><tr><th>Phone</th><th>Version</th><th>Accepted</th></tr>
${data.legalAcceptances.map((r) => `<tr><td>${r.phone_number}</td><td>${r.legal_version}</td><td>${r.accepted_at}</td></tr>`).join("\n")}</table>

</body></html>`);
  } catch (err) {
    console.error("Debug route error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Debug-only: mint a dashboard-admin JWT for local moderation testing.
 * Guarded by the same DEBUG/localhost gate as /tables.
 */
router.get("/admin-token", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const admins = await db.execute(
      "SELECT id FROM dashboard_admins ORDER BY created_at ASC LIMIT 1",
    );
    const row = admins.rows?.[0] as { id?: string } | undefined;
    if (!row?.id) {
      res.status(404).json({ error: "No dashboard_admin found" });
      return;
    }
    const token = await issueAdminToken(row.id);
    res.json({ adminId: row.id, token });
  } catch (err) {
    console.error("Debug admin-token route error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
