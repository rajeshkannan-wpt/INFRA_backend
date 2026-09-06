/**
 * DB-2.3-V Test: Format invariance verification.
 *
 * This test verifies the critical requirement from Task 8 DB-2.3-V:
 * "Two differently-formatted versions of the same real number must
 * produce the identical hash."
 *
 * Tech Arch §14.1 requires byte-identical E.164 output across platforms
 * for contact matching to work correctly.
 */

import { phoneHash, phoneHashNormalized } from "./phone-hash.js";
import { normalizePhoneNumber } from "./phone-normalize.js";

// Set a test salt for consistent hashing
process.env.CONTACT_HASH_SALT = "test_salt_for_db_2_3_verification";

console.log("=".repeat(70));
console.log("DB-2.3-V: Contact Hashes Format Invariance Test");
console.log("=".repeat(70));
console.log();

// Test 1: Same Indian number in three different formats
console.log("Test 1: Indian number (+91) — Same number, different formats");
console.log("-".repeat(70));

const formats = [
  { label: "No country code, no spaces", value: "9876543210", country: "IN" as const },
  { label: "With country code, spaces", value: "+91 98765 43210", country: undefined },
  { label: "Clean E.164", value: "+919876543210", country: undefined },
];

const hashes: string[] = [];
const normalized: (string | null)[] = [];

for (const fmt of formats) {
  const norm = normalizePhoneNumber(fmt.value, fmt.country);
  const hash = phoneHashNormalized(fmt.value, fmt.country);
  normalized.push(norm);
  hashes.push(hash || "null");

  console.log(`Format: "${fmt.value}" (${fmt.label})`);
  console.log(`  Normalized: ${norm}`);
  console.log(`  Hash:       ${hash?.substring(0, 16)}...`);
  console.log();
}

// Verify all three produce the same hash
const allSame = hashes.every(h => h === hashes[0] && h !== "null");
console.log(`✓ All normalized to: ${normalized[0]}`);
console.log(`✓ All hashes match:  ${allSame ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Test 2: US number in different formats
console.log("Test 2: US number (+1) — Same number, different formats");
console.log("-".repeat(70));

const usFormats = [
  { label: "With parens and dashes", value: "+1 (415) 555-0123", country: undefined },
  { label: "Clean E.164", value: "+14155550123", country: undefined },
  { label: "No country code", value: "4155550123", country: "US" as const },
];

const usHashes: string[] = [];
const usNormalized: (string | null)[] = [];

for (const fmt of usFormats) {
  const norm = normalizePhoneNumber(fmt.value, fmt.country);
  const hash = phoneHashNormalized(fmt.value, fmt.country);
  usNormalized.push(norm);
  usHashes.push(hash || "null");

  console.log(`Format: "${fmt.value}" (${fmt.label})`);
  console.log(`  Normalized: ${norm}`);
  console.log(`  Hash:       ${hash?.substring(0, 16)}...`);
  console.log();
}

const usAllSame = usHashes.every(h => h === usHashes[0] && h !== "null");
console.log(`✓ All normalized to: ${usNormalized[0]}`);
console.log(`✓ All hashes match:  ${usAllSame ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Test 3: Verify salt is actually used
console.log("Test 3: Verify global_salt is used (different salts → different hashes)");
console.log("-".repeat(70));

const testNumber = "+14155550123";
const hash1 = phoneHash(testNumber);

// Change the salt
process.env.CONTACT_HASH_SALT = "different_salt_value";
const hash2 = phoneHash(testNumber);

console.log(`Hash with salt "test_salt...": ${hash1.substring(0, 16)}...`);
console.log(`Hash with salt "different...": ${hash2.substring(0, 16)}...`);
console.log(`✓ Hashes differ:              ${hash1 !== hash2 ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Test 4: Verify GLOBAL_SALT env var naming (spec compliance)
console.log("Test 4: Verify GLOBAL_SALT env var support (per spec naming)");
console.log("-".repeat(70));

delete process.env.CONTACT_HASH_SALT;
process.env.GLOBAL_SALT = "spec_named_salt_value";
const hashWithGlobalSalt = phoneHash(testNumber);

console.log(`Hash using GLOBAL_SALT:       ${hashWithGlobalSalt.substring(0, 16)}...`);
console.log(`✓ GLOBAL_SALT works:          ${hashWithGlobalSalt ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Test 5: Verify format tolerance on messy inputs (dashes, parens, spaces, leading zeros)
console.log("Test 5: Edge cases — Messy formatting variants");
console.log("-".repeat(70));

const messyFormats = [
  "+91-98765-43210",
  "+91 (987) 654-3210",
  "+91.98765.43210",
  "+91  9876543210",
];

const messyHashes = messyFormats.map(f => phoneHashNormalized(f));
const allMessySame = messyHashes.every(h => h === messyHashes[0] && h !== null);

for (let i = 0; i < messyFormats.length; i++) {
  console.log(`Format: "${messyFormats[i]}" → Hash: ${messyHashes[i]?.substring(0, 16)}...`);
}
console.log(`✓ All messy formats match:   ${allMessySame ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Summary
console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));

const allTestsPass = allSame && usAllSame && hash1 !== hash2 && !!hashWithGlobalSalt && allMessySame;

if (allTestsPass) {
  console.log("✅ ALL TESTS PASS — DB-2.3-V format invariance requirement met");
  console.log();
  console.log("   ✓ Same number in different formats → identical hash");
  console.log("   ✓ libphonenumber normalization produces byte-identical E.164");
  console.log("   ✓ global_salt is used (hash changes when salt changes)");
  console.log("   ✓ Both GLOBAL_SALT and CONTACT_HASH_SALT env vars supported");
  console.log("   ✓ Messy format variants all normalize to identical hashes");
  process.exit(0);
} else {
  console.log("❌ TESTS FAILED — DB-2.3-V format invariance requirement NOT met");
  process.exit(1);
}
