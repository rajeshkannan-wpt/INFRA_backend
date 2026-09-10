/**
 * Test script — demonstrates the existing-account branch check flow.
 *
 * Run: npx tsx src/db/test-existing-account-flow.ts
 *
 * What it does:
 *   1. Accepts legal for a test phone number
 *   2. Sends OTP
 *   3. Verifies OTP for a NEW number → expects routing: "profile_setup"
 *   4. Verifies OTP for the SAME number again → expects routing: "chats"
 *   5. Confirms no duplicate user row was created
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env from backend root
try {
  const env = readFileSync(resolve(import.meta.dirname, "../../.env"), "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found — rely on shell env */ }

const BASE = process.env.BACKEND_URL || "http://localhost:4000";
const API = `${BASE}/api/v1/onboarding`;

const NEW_NUMBER = "+919000000001";

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function testNumber(label: string, phoneNumber: string) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`TEST: ${label} (${phoneNumber})`);
  console.log("=".repeat(50));

  // 1. Accept legal
  console.log("\n1. Accepting legal...");
  const legal = await post("/accept-legal", { phoneNumber });
  console.log(`   Result: ${JSON.stringify(legal.data)}`);

  // 2. Send OTP
  console.log("\n2. Sending OTP...");
  const send = await post("/otp/send", { phoneNumber });
  console.log(`   Result: ${JSON.stringify(send.data)}`);

  // 3. Verify OTP (code: 123456)
  console.log("\n3. Verifying OTP...");
  const verify = await post("/otp/verify", { phoneNumber, code: "123456" });
  console.log(`   Result: ${JSON.stringify(verify.data)}`);

  if (verify.data.status === "success") {
    console.log(`\n   ✓ routing = "${verify.data.routing}"`);
    console.log(`   ✓ userId  = "${verify.data.userId}"`);
    console.log(`   ✓ tokens issued = ${!!verify.data.accessToken}`);
  }

  return verify.data;
}

async function main() {
  console.log("Existing-Account Branch Check — Flow Test");
  console.log(`Backend: ${API}`);

  // Test 1: New number → should get routing: "profile_setup"
  const result1 = await testNumber("NEW user", NEW_NUMBER);

  // Test 2: Same number again → should get routing: "chats"
  const result2 = await testNumber("EXISTING user (same number)", NEW_NUMBER);

  // Verify
  console.log(`\n${"=".repeat(50)}`);
  console.log("VERIFICATION");
  console.log("=".repeat(50));

  if (result1.status === "success" && result1.routing === "profile_setup") {
    console.log("✓ New number routed to profile_setup");
  } else {
    console.log("✗ New number routing failed:", result1);
  }

  if (result2.status === "success" && result2.routing === "chats") {
    console.log("✓ Existing number routed to chats");
  } else {
    console.log("✗ Existing number routing failed:", result2);
  }

  if (result1.status === "success" && result2.status === "success" && result1.userId === result2.userId) {
    console.log("✓ Same userId returned for both calls (no duplicate)");
  } else {
    console.log("✗ userId mismatch or failure");
  }

  // Check DB directly for duplicate rows
  console.log("\n4. Checking DB for duplicate rows...");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(
    'SELECT COUNT(*) as count FROM "public"."users" WHERE "phone_number" = $1',
    [NEW_NUMBER]
  );
  const count = parseInt(res.rows[0].count);
  console.log(`   Rows for ${NEW_NUMBER}: ${count} ${count === 1 ? "✓" : "✗ DUPLICATE!"}`);

  await pool.end();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
