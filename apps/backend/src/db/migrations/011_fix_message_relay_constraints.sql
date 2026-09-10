-- ============================================================
-- 011_fix_message_relay_constraints.sql
-- Run this in: Supabase → SQL Editor → New Query → Run
--
-- BUG FIX: DB-2.2-V — migration 004 defined recipient_device_id
-- as nullable and added CHECK message_relay_one_recipient_check
-- ((user)+(device)+(group) = 1). That constraint is self-
-- contradictory for the per-device relay model: every relay row
-- always sets recipient_device_id (NOT NULL) together with one of
-- recipient_user_id / recipient_group_id, so a 3-way XOR would
-- reject every valid insert. The live schema (verified in the
-- DB-2.2-V evidence) instead uses:
--   * recipient_device_id uuid NOT NULL
--   * CHECK message_relay_recipient_exactly_one (user XOR group)
--   * CHECK message_relay_size_bytes_non_negative
--   * FKs: sender_device_id -> devices(id),
--          recipient_device_id -> devices(id),
--          recipient_user_id   -> users(id),
--          recipient_group_id  -> groups(id)
--  all ON DELETE CASCADE.
-- This migration converges the repo DDL onto that verified live
-- schema. Every statement is idempotent so it can be re-run safely.
-- ============================================================

-- 1. recipient_device_id must be NOT NULL (matches live).
ALTER TABLE public.message_relay
    ALTER COLUMN recipient_device_id SET NOT NULL;

-- 2. Replace the legacy 3-way recipient CHECK with the verified
--    user-XOR-group rule. Drop the old constraint first so this
--    file converges already-applied databases.
ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_one_recipient_check;

ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_recipient_exactly_one;

ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_recipient_exactly_one
    CHECK (
        (recipient_user_id IS NOT NULL AND recipient_group_id IS NULL)
        OR
        (recipient_user_id IS NULL AND recipient_group_id IS NOT NULL)
    );

-- 3. size_bytes must be non-negative (matches live).
ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_size_bytes_non_negative;

ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_size_bytes_non_negative
    CHECK (size_bytes >= 0);

-- 4. Foreign keys (matches live; drop-if-exists then re-add so the
--    script is re-runnable on databases that already applied one).
ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_sender_device_id_devices_id_fk;
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_sender_device_id_devices_id_fk
    FOREIGN KEY (sender_device_id) REFERENCES public.devices (id)
    ON DELETE CASCADE;

ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_recipient_device_id_devices_id_fk;
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_recipient_device_id_devices_id_fk
    FOREIGN KEY (recipient_device_id) REFERENCES public.devices (id)
    ON DELETE CASCADE;

ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_recipient_user_id_users_id_fk;
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_recipient_user_id_users_id_fk
    FOREIGN KEY (recipient_user_id) REFERENCES public.users (id)
    ON DELETE CASCADE;

ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_recipient_group_id_groups_id_fk;
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_recipient_group_id_groups_id_fk
    FOREIGN KEY (recipient_group_id) REFERENCES public.groups (id)
    ON DELETE CASCADE;

-- 5. Re-assert the enum-backed message_type default after any column
--    churn (no-op when 006 already applied).
ALTER TABLE public.message_relay
    ALTER COLUMN message_type SET DEFAULT 'text'::public.message_type_enum;