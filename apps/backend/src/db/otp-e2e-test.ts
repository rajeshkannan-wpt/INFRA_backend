/**
 * End-to-end test for OTP flow.
 * 
 * Tests:
 *   1. accept-legal → records acceptance
 *   2. otp/send → generates code, stores hash in DB, queues SMS
 *   3. otp/verify with correct code → atomic handoff, tokens issued
 *   4. otp/verify with wrong code (3x) → lockout
 *   5. resend cooldown check
 *   6. Verify DB state: otp_verifications row deleted, sms_outbox queued
 */

import pg from "pg";

const BASE = "http://localhost:4000/api/v1/onboarding";
const TEST_PHONE = `+1555${String(Date.now()).slice(-7)}`;

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function post(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log(`\n=== OTP E2E Test ===`);
  console.log(`Test phone: ${TEST_PHONE}\n`);

  // ── 1. Accept legal ──
  console.log("1. Accept legal");
  const legal = await post("/accept-legal", { phoneNumber: TEST_PHONE });
  assert("status 200", legal.status === 200, `got ${legal.status}`);
  assert("success: true", legal.data.success === true);

  // ── 2. Send OTP ──
  console.log("\n2. Send OTP");
  const send = await post("/otp/send", { phoneNumber: TEST_PHONE });
  assert("status 200", send.status === 200, `got ${send.status}`);
  assert("success: true", send.data.success === true);

  // ── 3. Check DB: otp_verifications row exists with hash ──
  console.log("\n3. Check DB: otp_verifications");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const dbClient = await pool.connect();
  try {
    const otpRow = await dbClient.query(
      "SELECT phone_number, code_hash, expires_at, attempts, locked_until FROM otp_verifications WHERE phone_number = $1",
      [TEST_PHONE],
    );
    assert("otp row exists", otpRow.rows.length === 1);
    if (otpRow.rows.length === 1) {
      const row = otpRow.rows[0];
      assert("code_hash is SHA-256 (64 chars)", row.code_hash.length === 64);
      assert("attempts = 0", row.attempts === 0);
      assert("locked_until is null", row.locked_until === null);
      assert("expires_at > now", new Date(row.expires_at) > new Date());
    }

    // ── 4. Check DB: sms_outbox row queued ──
    console.log("\n4. Check DB: sms_outbox");
    const smsRow = await dbClient.query(
      "SELECT phone_number, message, status FROM sms_outbox WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1",
      [TEST_PHONE],
    );
    assert("sms_outbox row exists", smsRow.rows.length === 1);
    if (smsRow.rows.length === 1) {
      const sms = smsRow.rows[0];
      assert("status = pending", sms.status === "pending");
      assert("message contains code digits", /\d{6}/.test(sms.message));
      // Verify the raw code is in the SMS but NOT in otp_verifications
      const rawCodeMatch = sms.message.match(/(\d{6})/);
      if (rawCodeMatch) {
        const rawCode = rawCodeMatch[1];
        assert("raw code NOT in otp_verifications hash", !otpRow.rows[0].code_hash.includes(rawCode));
      }
    }

    // ── 5. Verify with WRONG code (3 times) → lockout ──
    console.log("\n5. Wrong code attempts → lockout");
    const wrong1 = await post("/otp/verify", { phoneNumber: TEST_PHONE, code: "000000" });
    assert("wrong #1: status 200", wrong1.status === 200);
    assert("wrong #1: wrong_code", wrong1.data.status === "wrong_code");
    assert("wrong #1: 2 remaining", wrong1.data.attemptsRemaining === 2);

    const wrong2 = await post("/otp/verify", { phoneNumber: TEST_PHONE, code: "111111" });
    assert("wrong #2: wrong_code", wrong2.data.status === "wrong_code");
    assert("wrong #2: 1 remaining", wrong2.data.attemptsRemaining === 1);

    const wrong3 = await post("/otp/verify", { phoneNumber: TEST_PHONE, code: "222222" });
    assert("wrong #3: attempts_exhausted", wrong3.data.status === "attempts_exhausted");

    // 4th attempt should be locked out
    const locked = await post("/otp/verify", { phoneNumber: TEST_PHONE, code: "333333" });
    assert("4th attempt: locked_out", locked.data.status === "locked_out");
    assert("lockout has secondsRemaining", typeof locked.data.secondsRemaining === "number" && locked.data.secondsRemaining > 0);

    // Check DB: locked_until is set
    const lockCheck = await dbClient.query(
      "SELECT locked_until, attempts FROM otp_verifications WHERE phone_number = $1",
      [TEST_PHONE],
    );
    if (lockCheck.rows.length === 1) {
      assert("DB locked_until is set", lockCheck.rows[0].locked_until !== null);
      assert("DB attempts = 3", lockCheck.rows[0].attempts === 3);
    }

    // ── 6. Resend cooldown ──
    console.log("\n6. Resend cooldown");
    const resend = await post("/otp/send", { phoneNumber: TEST_PHONE });
    assert("resend blocked: status 429", resend.status === 429);
    assert("resend: RESEND_COOLDOWN_ACTIVE", resend.data.error === "RESEND_COOLDOWN_ACTIVE");
    assert("resend: secondsRemaining > 0", resend.data.secondsRemaining > 0);

    // ── 7. Wait for lockout to expire, then resend + verify correctly ──
    console.log("\n7. Wait for lockout expiry (~31s)...");
    await new Promise((r) => setTimeout(r, 31_000));

    console.log("   Resend OTP (cooldown should be expired)...");
    const resendOk = await post("/otp/send", { phoneNumber: TEST_PHONE });
    assert("resend after cooldown: 200", resendOk.status === 200);

    // Get the new code from sms_outbox
    const newSms = await dbClient.query(
      "SELECT message FROM sms_outbox WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1",
      [TEST_PHONE],
    );
    const codeMatch = newSms.rows[0]?.message?.match(/(\d{6})/);
    const realCode = codeMatch?.[1];
    assert("new OTP code extracted from sms_outbox", !!realCode);

    if (realCode) {
      console.log(`\n8. Verify with correct code (${realCode})`);
      const verifyOk = await post("/otp/verify", { phoneNumber: TEST_PHONE, code: realCode });
      assert("verify: status 200", verifyOk.status === 200);
      assert("verify: success", verifyOk.data.status === "success");
      assert("verify: routing present", ["chats", "profile_setup"].includes(verifyOk.data.routing));
      assert("verify: accessToken issued", !!verifyOk.data.accessToken);
      assert("verify: refreshToken issued", !!verifyOk.data.refreshToken);
      assert("verify: userId present", !!verifyOk.data.userId);
      assert("verify: sessionId present", !!verifyOk.data.sessionId);

      // ── 9. Check DB: otp_verifications row DELETED after success ──
      console.log("\n9. Check DB: OTP row deleted after success");
      const deletedRow = await dbClient.query(
        "SELECT phone_number FROM otp_verifications WHERE phone_number = $1",
        [TEST_PHONE],
      );
      assert("otp_verifications row deleted", deletedRow.rows.length === 0);

      // ── 10. Check DB: user created ──
      console.log("\n10. Check DB: user created");
      const userRow = await dbClient.query(
        "SELECT id, phone_number FROM users WHERE phone_number = $1",
        [TEST_PHONE],
      );
      assert("user row exists", userRow.rows.length === 1);

      // ── 11. Check DB: session created ──
      console.log("\n11. Check DB: session created");
      const sessRow = await dbClient.query(
        "SELECT id, user_id, device_id, revoked_at FROM sessions WHERE user_id = $1",
        [verifyOk.data.userId],
      );
      assert("session row exists", sessRow.rows.length >= 1);
      if (sessRow.rows.length >= 1) {
        assert("session not revoked", sessRow.rows[0].revoked_at === null);
      }
    }
  } finally {
    dbClient.release();
    await pool.end();
  }

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
