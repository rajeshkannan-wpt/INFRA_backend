const { Client } = require("pg");
const c = new Client({
  connectionString:
    "postgresql://postgres:WhitePixcelTechnologies@db.ukmsgzvkvcsbhtlmvswr.supabase.co:6543/postgres",
});

(async () => {
  await c.connect();

  console.log("=== OTP VERIFICATIONS TABLE ===");
  const otp = await c.query(
    "SELECT phone_number, code_hash, expires_at, attempts, locked_until, sent_at FROM otp_verifications ORDER BY sent_at DESC LIMIT 5"
  );
  if (otp.rows.length === 0) {
    console.log("  (empty - no pending OTPs)");
  } else {
    otp.rows.forEach((r, i) => {
      console.log("  [" + (i + 1) + "] Phone: " + r.phone_number);
      console.log("      Hash: " + r.code_hash);
      console.log("      Expires: " + r.expires_at);
      console.log("      Attempts: " + r.attempts);
      console.log("      Locked: " + r.locked_until);
      console.log("      Sent: " + r.sent_at);
    });
  }

  console.log("");
  console.log("=== SMS OUTBOX TABLE ===");
  const sms = await c.query(
    "SELECT phone_number, otp_hash, status, created_at FROM sms_outbox ORDER BY created_at DESC LIMIT 5"
  );
  if (sms.rows.length === 0) {
    console.log("  (empty - no SMS queued)");
  } else {
    sms.rows.forEach((r, i) => {
      console.log("  [" + (i + 1) + "] Phone: " + r.phone_number);
      console.log("      OTP Hash: " + r.otp_hash);
      console.log("      Status: " + r.status);
      console.log("      Created: " + r.created_at);
    });
  }

  console.log("");
  console.log("=== USERS TABLE ===");
  const users = await c.query(
    "SELECT id, phone_number, name, photo, about, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT 5"
  );
  if (users.rows.length === 0) {
    console.log("  (empty - no users yet)");
  } else {
    users.rows.forEach((r, i) => {
      console.log("  [" + (i + 1) + "] ID: " + r.id);
      console.log("      Phone: " + r.phone_number);
      console.log("      Name: " + r.name);
      console.log("      Photo: " + (r.photo || "(none)"));
      console.log("      About: " + (r.about || "(none)"));
      console.log("      Created: " + r.created_at);
      console.log("      Updated: " + r.updated_at);
    });
  }

  console.log("");
  console.log("=== SESSIONS TABLE ===");
  const sess = await c.query(
    "SELECT id, user_id, device_id, revoked_at, created_at FROM sessions ORDER BY created_at DESC LIMIT 5"
  );
  if (sess.rows.length === 0) {
    console.log("  (empty - no sessions)");
  } else {
    sess.rows.forEach((r, i) => {
      console.log("  [" + (i + 1) + "] ID: " + r.id);
      console.log("      User: " + r.user_id);
      console.log("      Device: " + r.device_id);
      console.log("      Revoked: " + (r.revoked_at || "(active)"));
      console.log("      Created: " + r.created_at);
    });
  }

  console.log("");
  console.log("=== LEGAL ACCEPTANCES TABLE ===");
  const legal = await c.query(
    "SELECT phone_number, legal_version, accepted_at FROM legal_acceptances ORDER BY accepted_at DESC LIMIT 5"
  );
  if (legal.rows.length === 0) {
    console.log("  (empty - no legal acceptances)");
  } else {
    legal.rows.forEach((r, i) => {
      console.log("  [" + (i + 1) + "] Phone: " + r.phone_number);
      console.log("      Version: " + r.legal_version);
      console.log("      Accepted: " + r.accepted_at);
    });
  }

  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
