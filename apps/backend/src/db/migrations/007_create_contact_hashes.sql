-- ============================================================
-- 007_create_contact_hashes.sql
-- Run this in: Supabase -> SQL Editor -> New Query -> Run
--
-- DB-2.3-V: Privacy-preserving contact matching table.
-- phone_hash is SHA-256(global_salt + E.164_phone).
-- No raw phone numbers are stored.
--
-- user_id is uuid to match users.id (uuid) in the live DB.
-- This script is IDEMPOTENT — safe to re-run.
-- ============================================================

-- 1. Create the contact_hashes table (no-op if it already exists)
CREATE TABLE IF NOT EXISTS public.contact_hashes (
    phone_hash  text PRIMARY KEY,
    user_id     uuid NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Drop any existing FKs (legacy "contact_hashes_user_id_fkey" and the
--    drizzle-kit style "contact_hashes_user_id_users_id_fk") so re-runs do
--    not fail with 42710 and no duplicate FKs accumulate.
ALTER TABLE public.contact_hashes
    DROP CONSTRAINT IF EXISTS contact_hashes_user_id_fkey;
ALTER TABLE public.contact_hashes
    DROP CONSTRAINT IF EXISTS contact_hashes_user_id_users_id_fk;

-- 3. Foreign key: user_id references users(id)
ALTER TABLE public.contact_hashes
    ADD CONSTRAINT contact_hashes_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users (id)
    ON DELETE CASCADE;

-- 4. Index for lookups by user_id
CREATE INDEX IF NOT EXISTS idx_contact_hashes_user_id
    ON public.contact_hashes (user_id);