/**
 * Full integration test against Supabase.
 *
 * Flow:
 *   1. Issue a refresh token  → insert into sessions table
 *   2. Validate it            → hash lookup, revoked_at=null → ACCEPT
 *   3. Revoke the session     → set revoked_at to now
 *   4. Validate again         → hash lookup, revoked_at!=null → REJECT
 *   5. Unknown token          → no row found → REJECT
 *
 * Run:  $env:DATABASE_URL="..."; pnpm --filter @wpt/backend exec tsx src/auth/integration-test.ts
 */

import { issueRefreshToken, validateRefreshToken, revokeSession } from "./index.js";

const checks: string[] = [];

function assert(condition: boolean, label: string) {
  checks.push(condition ? `PASS  ${label}` : `FAIL  ${label}`);
}

async function main() {
  const testUserId = `test_user_${Date.now()}`;
  const testDeviceId = `test_device_${Date.now()}`;

  console.log(`Test user: ${testUserId}`);
  console.log(`Test device: ${testDeviceId}\n`);

  // --- Step 1: Issue a refresh token ---
  console.log("Step 1: Issuing refresh token...");
  const { refreshToken, sessionId } = await issueRefreshToken({
    userId: testUserId,
    deviceId: testDeviceId,
  });

  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Refresh token (first 20 chars): ${refreshToken.slice(0, 20)}...`);

  assert(refreshToken.length > 0, "refresh token is non-empty");
  assert(sessionId.length > 0, "session ID is non-empty");
  assert(refreshToken !== sessionId, "token and session ID are different");

  // --- Step 2: Validate the token (should succeed) ---
  console.log("\nStep 2: Validating token (should ACCEPT)...");
  const validSession = await validateRefreshToken(refreshToken);

  assert(validSession !== null, "token validation succeeds");
  assert(validSession?.sessionId === sessionId, "session ID matches");
  assert(validSession?.userId === testUserId, "user ID matches");
  assert(validSession?.deviceId === testDeviceId, "device ID matches");

  // --- Step 3: Revoke the session ---
  console.log("\nStep 3: Revoking session...");
  await revokeSession(sessionId);
  console.log("  Session revoked.");

  // --- Step 4: Validate again (should fail — revoked) ---
  console.log("\nStep 4: Validating revoked token (should REJECT)...");
  const revokedSession = await validateRefreshToken(refreshToken);

  assert(revokedSession === null, "revoked token is rejected");

  // --- Step 5: Unknown token (should fail — no row) ---
  console.log("\nStep 5: Validating unknown token (should REJECT)...");
  const fakeToken = "a".repeat(64) + "b".repeat(64); // won't match any hash
  const unknownSession = await validateRefreshToken(fakeToken);

  assert(unknownSession === null, "unknown token is rejected");

  // --- Step 6: Issue a second token and verify it works independently ---
  console.log("\nStep 6: Issuing second token (fresh session)...");
  const { refreshToken: token2, sessionId: session2 } = await issueRefreshToken({
    userId: testUserId,
    deviceId: "device_b",
  });

  const valid2 = await validateRefreshToken(token2);
  assert(valid2 !== null, "second token validates");
  assert(valid2?.sessionId === session2, "second session ID matches");
  assert(valid2?.deviceId === "device_b", "second token has correct device ID");

  // Revoke second session too (cleanup)
  await revokeSession(session2);

  // --- Results ---
  console.log("\n=== Results ===");
  checks.forEach((c) => console.log(c));

  const allPassed = checks.every((c) => c.startsWith("PASS"));
  console.log(`\n${allPassed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
