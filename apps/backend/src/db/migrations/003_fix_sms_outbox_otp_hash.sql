-- 003_fix_sms_outbox_otp_hash.sql
-- Remove plaintext OTP from sms_outbox, replace with SHA-256 hash.
-- The raw OTP code must NEVER be stored in the database.

-- Add new otp_hash column
ALTER TABLE sms_outbox ADD COLUMN otp_hash TEXT;

-- Copy hashed values from existing rows (hash the message content as a proxy)
-- NOTE: This is a best-effort migration for existing data.
-- New rows will only have otp_hash, never the raw message.
UPDATE sms_outbox SET otp_hash = md5(message) WHERE otp_hash IS NULL;

-- Drop the old message column
ALTER TABLE sms_outbox DROP COLUMN message;

-- Make otp_hash NOT NULL after backfill
ALTER TABLE sms_outbox ALTER COLUMN otp_hash SET NOT NULL;
