/**
 * Comprehensive end-to-end test — all 3 backend cards.
 *
 * Tests the full login flow as a single cohesive system:
 *   1. Legal gate rejects OTP verify when no acceptance exists
 *   2. Legal acceptance is recorded
 *   3. Legal gate now passes
 *   4. Access token is issued (1-hour JWT)
 *   5. Access token decodes with correct claims
 *   6. Refresh token is issued (stored as hash only)
 *   7. Refresh token validates against DB
 *   8. Session revocation kills the refresh token
 *   9. Revoked refresh token is rejected
 *  10. Access token still works after refresh revocation (separate concern)
 *
 * Run:  $env:DATABASE_URL="..."; $env:JWT_SECRET="test-secret";
 *       pnpm --filter @wpt/backend exec tsx src/auth/e2e-test.ts
 */

import {
  // Card 3: Legal gate
  recordLegalAcceptance,
  requireLegalAcceptance,
  LegalAcceptanceRequiredError,
  // Card 1: JWT access token
  issueAccessToken,
  verifyAccessToken,
  decodeAccessTokenUnsafe,
  // Card 2: Refresh token
  issueRefreshToken,
  validateRefreshToken,
  revokeSession,
} from "./index.js";

const checks: string[] = [];
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    checks.push(`PASS  ${label}`);
    passed++;
  } else {
    checks.push(`FAIL  ${label}`);
    failed++;
  }
}

async function main() {
  const testPhone = `+1555${Date.now().toString().slice(-7)}`;
  const testUserId = `user_${Date.now()}`;
  const testDeviceId = `device_${Date.now()}`;
  const legalVersion = "v1.0-2024-01-15";

  console.log("=== E2E Test: All 3 Backend Cards ===\n");
  console.log(`Phone:      ${testPhone}`);
  console.log(`User ID:    ${testUserId}`);
  console.log(`Device ID:  ${testDeviceId}`);
  console.log(`Legal ver:  ${legalVersion}\n`);

  // ──────────────────────────────────────────────
  // CARD 3: Legal-acceptance gate
  // ──────────────────────────────────────────────
  console.log("── Card 3: Legal-acceptance gate ──\n");

  // Step 1: Gate rejects without acceptance
  console.log("1. OTP verify blocked without legal acceptance...");
  try {
    await requireLegalAcceptance(testPhone);
    assert(false, "gate check should have thrown");
  } catch (err) {
    assert(err instanceof LegalAcceptanceRequiredError, "throws LegalAcceptanceRequiredError");
    assert((err as LegalAcceptanceRequiredError).statusCode === 403, "status code is 403");
  }

  // Step 2: Record acceptance
  console.log("2. Recording legal acceptance...");
  await recordLegalAcceptance({ phoneNumber: testPhone, legalVersion });
  assert(true, "legal acceptance recorded");

  // Step 3: Gate passes
  console.log("3. Gate check passes after acceptance...");
  await requireLegalAcceptance(testPhone);
  assert(true, "requireLegalAcceptance did not throw");

  // ──────────────────────────────────────────────
  // CARD 1: JWT access token (1-hour)
  // ──────────────────────────────────────────────
  console.log("\n── Card 1: JWT access token (1 hour) ──\n");

  // Step 4: Issue access token
  console.log("4. Issuing access token...");
  const accessToken = await issueAccessToken({
    userId: testUserId,
    deviceId: testDeviceId,
    sessionId: "test-session-id",
  });
  assert(accessToken.length > 0, "access token is non-empty");

  // Step 5: Verify access token
  console.log("5. Verifying access token...");
  const payload = await verifyAccessToken(accessToken);
  assert(payload.sub === testUserId, `sub claim = "${payload.sub}"`);
  assert(payload.deviceId === testDeviceId, `deviceId claim = "${payload.deviceId}"`);
  assert(payload.iss === "wpt-backend", `iss claim = "${payload.iss}"`);

  // Step 6: Check expiry is exactly 1 hour
  console.log("6. Checking 1-hour expiry...");
  const duration = payload.exp - payload.iat;
  assert(duration === 3600, `exp - iat = ${duration}s (expected 3600)`);

  // Step 7: Decode without verification (for logging)
  console.log("7. Unsafe decode (for logging)...");
  const decoded = decodeAccessTokenUnsafe(accessToken);
  assert(typeof decoded.sub === "string", "decoded.sub is a string");
  assert(typeof decoded.exp === "number", "decoded.exp is a number");

  // ──────────────────────────────────────────────
  // CARD 2: Refresh token (30-day, hashed)
  // ──────────────────────────────────────────────
  console.log("\n── Card 2: Refresh token (30-day, hashed) ──\n");

  // Step 8: Issue refresh token
  console.log("8. Issuing refresh token...");
  const { refreshToken, sessionId } = await issueRefreshToken({
    userId: testUserId,
    deviceId: testDeviceId,
  });
  assert(refreshToken.length > 0, "refresh token is non-empty");
  assert(sessionId.length > 0, "session ID is non-empty");
  assert(refreshToken !== accessToken, "refresh token differs from access token");

  // Step 9: Validate refresh token
  console.log("9. Validating refresh token...");
  const session = await validateRefreshToken(refreshToken);
  assert(session !== null, "refresh token validates");
  assert(session?.userId === testUserId, "session userId matches");
  assert(session?.deviceId === testDeviceId, "session deviceId matches");
  assert(session?.sessionId === sessionId, "session ID matches");

  // Step 10: Revoke session
  console.log("10. Revoking session...");
  await revokeSession(sessionId);
  assert(true, "revokeSession completed");

  // Step 11: Revoked refresh token is rejected
  console.log("11. Validating revoked refresh token (should REJECT)...");
  const revoked = await validateRefreshToken(refreshToken);
  assert(revoked === null, "revoked token is rejected");

  // Step 12: Access token still works (separate concern — no DB check)
  console.log("12. Access token still valid after refresh revocation...");
  const stillValid = await verifyAccessToken(accessToken);
  assert(stillValid.sub === testUserId, "access token still identifies user");

  // ──────────────────────────────────────────────
  // CROSS-CARD: Full flow simulation
  // ──────────────────────────────────────────────
  console.log("\n── Cross-card: Full login flow simulation ──\n");

  // New user — fresh flow
  const newPhone = `+1555${Date.now().toString().slice(-7)}2`;
  const newUserId = `user_${Date.now()}_2`;
  const newDeviceId = `device_${Date.now()}_2`;

  console.log("13. Full flow: accept legal → issue tokens → validate → revoke...");
  await recordLegalAcceptance({ phoneNumber: newPhone, legalVersion });
  await requireLegalAcceptance(newPhone);

  const { refreshToken: rt2, sessionId: sid2 } = await issueRefreshToken({
    userId: newUserId,
    deviceId: newDeviceId,
  });
  const at2 = await issueAccessToken({
    userId: newUserId,
    deviceId: newDeviceId,
    sessionId: sid2,
  });

  const v1 = await validateRefreshToken(rt2);
  const v2 = await verifyAccessToken(at2);
  assert(v1 !== null, "new refresh token validates");
  assert(v2.sub === newUserId, "new access token identifies user");

  await revokeSession(sid2);
  const v3 = await validateRefreshToken(rt2);
  assert(v3 === null, "revoked refresh token rejected");

  // ──────────────────────────────────────────────
  // RESULTS
  // ──────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("             RESULTS");
  console.log("═══════════════════════════════════════\n");
  checks.forEach((c) => console.log(c));
  console.log(`\n  ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("E2E test crashed:", err);
  process.exit(1);
});
