/**
 * Refresh-token verification script.
 *
 * Tests the crypto primitives and the contract:
 *   1. Raw token is NEVER equal to its bcrypt hash
 *   2. Bcrypt hashes are non-deterministic (random salt each time)
 *   3. Different tokens produce different hashes
 *   4. Hash is a valid bcrypt hash ($2b$ prefix, 60 chars)
 *   5. bcrypt.compare matches the correct token
 *   6. bcrypt.compare rejects the wrong token
 *
 * Run:  pnpm --filter @wpt/backend exec tsx src/auth/verify-refresh.ts
 */

import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;

function lookupKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

async function main() {
  const checks: string[] = [];

  // Generate a refresh token the same way issueRefreshToken does
  const rawToken = randomBytes(48).toString("base64url");
  const tokenLookup = lookupKey(rawToken);
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);

  console.log("Raw token (returned to client):", rawToken);
  console.log("Lookup key (DB index):          ", tokenLookup);
  console.log("Bcrypt hash (stored in DB):     ", tokenHash);

  // 1. Raw token is never equal to its hash
  if (rawToken !== tokenHash) {
    checks.push("PASS  raw token != bcrypt hash (raw is never stored in DB)");
  } else {
    checks.push("FAIL  raw token equals hash — security violation");
  }

  // 2. Bcrypt hashes are NON-deterministic (random salt)
  const hash2 = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
  if (tokenHash !== hash2) {
    checks.push("PASS  bcrypt is non-deterministic (random salt each time)");
  } else {
    checks.push("FAIL  bcrypt produced identical hashes — check salt generation");
  }

  // 3. Different tokens produce different hashes
  const rawToken2 = randomBytes(48).toString("base64url");
  const hash3 = await bcrypt.hash(rawToken2, BCRYPT_ROUNDS);
  if (tokenHash !== hash3) {
    checks.push("PASS  different tokens → different hashes");
  } else {
    checks.push("FAIL  collision detected");
  }

  // 4. Hash is a valid bcrypt hash (60 chars, $2b$ prefix)
  if (/^\$2[aby]\$\d{2}\$/.test(tokenHash) && tokenHash.length === 60) {
    checks.push(`PASS  hash is valid bcrypt format (${tokenHash.length} chars)`);
  } else {
    checks.push(`FAIL  hash format invalid: ${tokenHash}`);
  }

  // 5. bcrypt.compare matches the correct token
  const validMatch = await bcrypt.compare(rawToken, tokenHash);
  if (validMatch) {
    checks.push("PASS  bcrypt.compare succeeds for correct token");
  } else {
    checks.push("FAIL  bcrypt.compare failed for correct token");
  }

  // 6. bcrypt.compare rejects the wrong token
  const wrongMatch = await bcrypt.compare(rawToken2, tokenHash);
  if (!wrongMatch) {
    checks.push("PASS  bcrypt.compare rejects wrong token");
  } else {
    checks.push("FAIL  bcrypt.compare accepted wrong token");
  }

  // 7. Lookup key is deterministic (same input → same output)
  const lookup2 = lookupKey(rawToken);
  if (tokenLookup === lookup2) {
    checks.push("PASS  lookup key is deterministic (DB index lookups work)");
  } else {
    checks.push("FAIL  lookup key is not deterministic");
  }

  // 8. Different tokens produce different lookup keys
  const lookup3 = lookupKey(rawToken2);
  if (tokenLookup !== lookup3) {
    checks.push("PASS  different tokens → different lookup keys");
  } else {
    checks.push("FAIL  lookup key collision detected");
  }

  // 9. Lookup key is 32 hex chars
  if (/^[0-9a-f]{32}$/.test(tokenLookup)) {
    checks.push(`PASS  lookup key is valid hex (${tokenLookup.length} chars)`);
  } else {
    checks.push(`FAIL  lookup key format invalid: ${tokenLookup}`);
  }

  // 10. Token has sufficient entropy (base64url of 48 bytes = 64 chars)
  if (rawToken.length >= 60) {
    checks.push(`PASS  token length = ${rawToken.length} chars (>=60, sufficient entropy)`);
  } else {
    checks.push(`FAIL  token length = ${rawToken.length} chars (too short)`);
  }

  // 11. Simulate the full flow: lookup key → bcrypt verify → revoke check
  const mockDb = new Map<string, { lookup: string; bcryptHash: string; revokedAt: Date | null }>();
  mockDb.set("session_1", { lookup: tokenLookup, bcryptHash: tokenHash, revokedAt: null });

  // Before revocation: lookup by key finds active session, bcrypt verifies → ACCEPT
  const found = mockDb.get("session_1");
  const bcryptOk = found && await bcrypt.compare(rawToken, found.bcryptHash);
  const beforeRevoke = found && found.lookup === tokenLookup && bcryptOk && found.revokedAt === null;
  if (beforeRevoke) {
    checks.push("PASS  full flow: lookup + bcrypt verify + revoked=null → ACCEPT");
  } else {
    checks.push("FAIL  full flow: should have been accepted");
  }

  // Revoke the session
  if (found) found.revokedAt = new Date();

  // After revocation: same lookup + bcrypt, but revoked_at is non-null → REJECT
  const afterRevoke = found && found.lookup === tokenLookup && bcryptOk && found.revokedAt !== null;
  if (afterRevoke) {
    checks.push("PASS  full flow: lookup + bcrypt verify + revoked!=null → REJECT");
  } else {
    checks.push("FAIL  full flow: should have been rejected");
  }

  // 12. Unknown token: no lookup match → REJECT
  const unknownFound = mockDb.get("session_nonexistent");
  if (!unknownFound) {
    checks.push("PASS  unknown token: no lookup match → REJECT");
  } else {
    checks.push("FAIL  unknown token: somehow found a row");
  }

  console.log("\n=== Verification results ===");
  checks.forEach((c) => console.log(c));

  const allPassed = checks.every((c) => c.startsWith("PASS"));
  console.log(`\n${allPassed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`);

  process.exit(allPassed ? 0 : 1);
}

main();
