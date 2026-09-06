-- 008 — Remediation for Supabase_Backend_Test_Report findings
--
-- Live-DB status confirmed against public schema:
--
--   F-04 (devices.user_id vs users.id)  -> ALREADY FIXED in live DB.
--        users.id = uuid, devices.user_id = uuid, FK
--        "devices_user_id_users_id_fk" exists. No type mismatch.
--   F-05 (message_relay.sender_device_id FK) -> ALREADY FIXED in live DB.
--        FK "message_relay_sender_device_id_devices_id_fk" exists.
--   F-06 (sms_outbox.status CHECK) -> NOT APPLIED. Added below.
--
-- Note: the report described the Drizzle TS schema (users.id varchar(64));
-- the live Supabase DB uses uuid for users.id. Do NOT cast user_id
-- columns to varchar(64) — it breaks the existing uuid FKs.
--
-- This script is IDEMPOTENT — safe to re-run.
-- ============================================================

-- ──────────────────────────────────────────────────
-- F-04 — Verify devices.user_id is already aligned (uuid)
-- ──────────────────────────────────────────────────
-- No ALTER needed: devices.user_id is uuid and matches users.id (uuid).
-- The FK "devices_user_id_users_id_fk" already exists.
-- Re-created below as a DETERMINISTIC canonical FK (drop first, so this
-- is re-runnable) in case the DB was migrated away from it.
ALTER TABLE public.devices
    DROP CONSTRAINT IF EXISTS devices_user_id_users_id_fk;
ALTER TABLE public.devices
    ADD CONSTRAINT devices_user_id_users_id_fk
    FOREIGN KEY (user_id)
    REFERENCES public.users (id)
    ON DELETE CASCADE;

-- ──────────────────────────────────────────────────
-- F-05 — Verify message_relay.sender_device_id FK exists
-- ──────────────────────────────────────────────────
-- Re-created below with ON DELETE CASCADE (drop first, so this is
-- re-runnable). Matches the recommendation in the report.
ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_sender_device_id_devices_id_fk;
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_sender_device_id_devices_id_fk
    FOREIGN KEY (sender_device_id)
    REFERENCES public.devices (id)
    ON DELETE CASCADE;

-- ──────────────────────────────────────────────────
-- F-06 — CHECK constraint on sms_outbox.status
-- ──────────────────────────────────────────────────
-- 1. Normalize any invalid values to 'pending' before constraining.
UPDATE public.sms_outbox
SET status = 'pending'
WHERE status NOT IN ('pending', 'sent', 'failed');

-- 2. Add the named CHECK constraint (drop first so this is re-runnable).
ALTER TABLE public.sms_outbox
    DROP CONSTRAINT IF EXISTS sms_outbox_status_check;
ALTER TABLE public.sms_outbox
    ADD CONSTRAINT sms_outbox_status_check
    CHECK (status IN ('pending', 'sent', 'failed'));