# DB-2.3-V Manual Testing Guide
## Complete Step-by-Step Verification

**Date:** September 5, 2026  
**Purpose:** Verify all 4 critical errors from `DB2_3_Overall_Evidence_Testing_Document_4_errors.docx` are fixed

---

## Summary of 4 Critical Errors

| # | Error | Status | Fix Applied |
|---|---|---|---|
| **1** | **"Hashed client-side" privacy claim is FALSE** | ✅ FIXED | Documentation corrected in `TASK_8_DB_2.3_VERIFICATION.md` |
| **2** | **Missing `created_at` column breaks registration** | ⚠️ MIGRATION READY | Migration created: `009_fix_contact_hashes_add_created_at.sql` |
| **3** | **Live API does NOT normalize input formats** | ✅ FIXED | All endpoints now call `normalizePhoneNumber()` |
| **4** | **`bcrypt` dependency issue** | ✅ NO ISSUE | `bcrypt` works correctly in this environment |

---

## Prerequisites

### 1. Supabase Database Setup
You need a Supabase project with:
- Postgres database URL
- Tables created (users, contact_hashes, etc.)

### 2. Generate Required Secrets

```bash
# Generate CONTACT_HASH_SALT (or GLOBAL_SALT)
openssl rand -hex 32
# Example output: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Generate JWT_SECRET
openssl rand -hex 32
# Example output: fedcba0987654321fedcba0987654321fedcba0987654321fedcba098765432
```

### 3. Create `.env` File

Create `apps/backend/.env` (copy from `.env.example`):

```bash
cd "C:\Users\mervi\Downloads\backend-Team-Beta\INFRA_backend-Team-Beta\apps\backend"

# Create .env file with actual values
cat > .env << 'EOF'
PORT=4000
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
JWT_SECRET=fedcba0987654321fedcba0987654321fedcba0987654321fedcba098765432
CORS_ORIGIN=http://localhost:3000

# Contact hash global salt (required for DB-2.3)
GLOBAL_SALT=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# SMS delivery (optional - if unset, OTP prints to console)
# SMS_TWILIO_ACCOUNT_SID=
# SMS_TWILIO_AUTH_TOKEN=
# SMS_TWILIO_FROM=
EOF
```

**Replace:**
- `[PROJECT_REF]` with your Supabase project ref
- `[PASSWORD]` with your database password (URL-encoded if it contains special characters)
- `[REGION]` with your region (e.g., `us-east-1`)
- The secret values with your generated values from step 2

---

## CRITICAL: Run Migration FIRST

**Before starting the backend**, you MUST run the migration to add the `created_at` column:

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**

### Step 2: Run the Migration

Copy and paste this SQL:

```sql
-- ============================================================
-- 009_fix_contact_hashes_add_created_at.sql
-- DB-2.3-V Fix: Add missing created_at column to contact_hashes
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contact_hashes'
          AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.contact_hashes
            ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

        RAISE NOTICE 'Added created_at column to contact_hashes table';
    ELSE
        RAISE NOTICE 'created_at column already exists in contact_hashes table';
    END IF;
END $$;
```

Click **RUN** (or press F5)

### Step 3: Verify the Migration

Run this query to confirm:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'contact_hashes'
ORDER BY ordinal_position;
```

**Expected result:**
```
column_name  | data_type                   | is_nullable | column_default
-------------+-----------------------------+-------------+---------------
phone_hash   | text                        | NO          | NULL
user_id      | uuid                        | NO          | NULL
created_at   | timestamp with time zone    | NO          | now()
```

✅ If you see all 3 columns, proceed. If `created_at` is missing, **registration will fail**.

---

## Start the Backend

```bash
cd "C:\Users\mervi\Downloads\backend-Team-Beta\INFRA_backend-Team-Beta\apps\backend"

# Install dependencies (if not already done)
pnpm install

# Start development server
pnpm dev
```

**Expected output:**
```
> @wpt/backend@0.0.0 dev
> tsx watch src/index.ts

[API] Listening on port 4000
```

**⚠️ Note:** `tsx watch` does NOT restart when you change `.env`. You must **manually restart** (Ctrl+C, then `pnpm dev`) after any `.env` changes.

---

## Manual Test 1: Error #2 — Registration Without `created_at` Would Fail

**What we're testing:** That the migration fixed the registration-breaking bug.

### Before Migration (Expected Failure)
If you skip the migration and try to register, you'd get:
```
DrizzleQueryError: column "created_at" of relation "contact_hashes" does not exist
```

### After Migration (Expected Success)
With the migration applied, registration should succeed.

**Test it:** Proceed to Test 2 below — if registration works, Error #2 is fixed.

---

## Manual Test 2: Error #3 — Live API Format Tolerance

**What we're testing:** That the live `/otp/send` endpoint now normalizes phone inputs.

### Test 2a: Phone Number with Spaces (Previously REJECTED)

```bash
curl -X POST http://localhost:4000/api/v1/onboarding/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+91 98765 00022"}'
```

**Expected response:**
```json
{"success": true}
```

**Backend console should print:**
```
[SMS-DEV] OTP for +919876500022: 123456
```

✅ **PASS:** Number with spaces was normalized to `+919876500022`

### Test 2b: Phone Number Without Country Code (Previously REJECTED)

```bash
curl -X POST http://localhost:4000/api/v1/onboarding/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "9876500022"}'
```

**Expected response:**
```json
{"success": true}
```

✅ **PASS if accepted:** Number without country code was normalized (if you pass a default country in `normalizePhoneNumber()`)

⚠️ **Note:** Without a country code, `libphonenumber` cannot normalize. This will fail with `{"error":"INVALID_PHONE"}`. This is expected behavior unless you configure a default country.

### Test 2c: Phone Number with Dashes and Parens (Previously REJECTED)

```bash
curl -X POST http://localhost:4000/api/v1/onboarding/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1 (415) 555-0123"}'
```

**Expected response:**
```json
{"success": true}
```

**Backend console:**
```
[SMS-DEV] OTP for +14155550123: 789012
```

✅ **PASS:** Number with parens/dashes was normalized to `+14155550123`

---

## Manual Test 3: Full End-to-End Registration (Error #2 + #3 Combined)

**What we're testing:** Complete registration flow with format-tolerant input, verifying the `contact_hashes` row is created.

### Step 1: Accept Legal Terms

```bash
curl -X POST http://localhost:4000/api/v1/onboarding/accept-legal \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+91 98765 00099"}'
```

**Expected:**
```json
{"success": true}
```

### Step 2: Send OTP (with spaces in phone number)

```bash
curl -X POST http://localhost:4000/api/v1/onboarding/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+91 98765 00099"}'
```

**Expected:**
```json
{"success": true}
```

**Backend console will print:**
```
[SMS-DEV] OTP for +919876500099: 654321
```

**Copy the OTP code** (e.g., `654321`)

### Step 3: Verify OTP

```bash
curl -X POST http://localhost:4000/api/v1/onboarding/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+91 98765 00099",
    "code": "654321"
  }'
```

**Expected response:**
```json
{
  "status": "success",
  "routing": "profile_setup",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "cb_...",
  "userId": "8b90ad89-454b-442f-9fa3-a66b731892b0",
  "sessionId": "4f165a27-8dad-466c-af99-85a46b1e1bb7"
}
```

✅ **PASS:** Registration succeeded

### Step 4: Verify Database Row

Go to Supabase → **Table Editor** → `contact_hashes` table, or run SQL:

```sql
SELECT phone_hash, user_id, created_at
FROM contact_hashes
ORDER BY created_at DESC
LIMIT 5;
```

**Expected result:**
```
phone_hash                                                      | user_id                              | created_at
----------------------------------------------------------------+--------------------------------------+---------------------------
f51d942d236b3a7c1e4f5d8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b | 8b90ad89-454b-442f-9fa3-a66b731892b0 | 2026-09-05 12:24:59.613+00
```

✅ **PASS if:**
- Row exists
- `user_id` matches the `userId` from Step 3 response
- `created_at` column exists and has a timestamp
- `phone_hash` is a 64-character hex string (not a raw phone number)

---

## Manual Test 4: Error #1 — Privacy Architecture Documentation

**What we're testing:** That the documentation accurately reflects the server-side hashing architecture.

### Verify Documentation Fix

Open `TASK_8_DB_2.3_VERIFICATION.md` and find the **Privacy Guarantees** section:

**Expected text:**
```
✅ Phone numbers are normalized client-side via libphonenumber-js
✅ Hashing occurs server-side transiently during registration
(hash computed, plaintext not persisted)

Architecture Clarification:
The privacy architecture is: client normalizes → server hashes transiently
→ only the hash is persisted. The server briefly processes the plaintext
E.164 number to compute the hash but does not store it.
```

✅ **PASS:** Documentation now accurately describes server-side transient hashing

❌ **FAIL if:** Document still claims "hashed client-side before upload"

---

## Manual Test 5: Verify Format Invariance (Bonus)

**What we're testing:** Same number in different formats produces identical hash.

### Run the Test Suite

```bash
cd "C:\Users\mervi\Downloads\backend-Team-Beta\INFRA_backend-Team-Beta\apps\backend"
npx tsx src/utils/phone-hash.test.ts
```

**Expected output:**
```
✅ ALL TESTS PASS — DB-2.3-V format invariance requirement met

   ✓ Same number in different formats → identical hash
   ✓ libphonenumber normalization produces byte-identical E.164
   ✓ global_salt is used (hash changes when salt changes)
   ✓ Both GLOBAL_SALT and CONTACT_HASH_SALT env vars supported
   ✓ Messy format variants all normalize to identical hashes
```

✅ **PASS:** All 5 tests pass

---

## Verification Checklist

| Test | Description | Status |
|---|---|---|
| ☐ | Migration applied (created_at column exists) | |
| ☐ | Backend starts without errors | |
| ☐ | Test 2a: Phone with spaces accepted | |
| ☐ | Test 2c: Phone with parens/dashes accepted | |
| ☐ | Test 3: Full registration succeeds | |
| ☐ | Test 3: contact_hashes row created with created_at | |
| ☐ | Test 4: Documentation corrected | |
| ☐ | Test 5: Format invariance test passes | |

---

## Troubleshooting

### Issue: "column created_at does not exist"
**Cause:** Migration not run  
**Fix:** Go back to "CRITICAL: Run Migration FIRST" section

### Issue: "CONTACT_HASH_SALT environment variable is required"
**Cause:** `.env` file missing or empty  
**Fix:** Create `.env` with GLOBAL_SALT value (see Prerequisites)

### Issue: Backend doesn't restart after changing .env
**Cause:** `tsx watch` only watches source files  
**Fix:** Press Ctrl+C, then run `pnpm dev` again

### Issue: "INVALID_PHONE" for number without country code
**Cause:** `libphonenumber` requires country code for normalization  
**Fix:** Always include `+` and country code (e.g., `+91` for India, `+1` for US)

### Issue: "Cannot find module 'bcrypt'"
**Cause:** Dependencies not installed  
**Fix:** Run `pnpm install` in `apps/backend`

---

## Expected Final State

✅ **All 4 errors resolved:**
1. Documentation accurately describes server-side transient hashing
2. Migration adds `created_at` column — registration works
3. Live API accepts phone numbers with spaces, dashes, parentheses
4. `bcrypt` dependency works correctly (no issue found)

✅ **Test suite passes:** 5/5 tests passing

✅ **Live end-to-end works:** Registration with messy phone format → row in database with hash

---

**Testing Complete!**  
Mark DB-2.3-V as **FULLY VERIFIED** once all checkboxes are ticked.
