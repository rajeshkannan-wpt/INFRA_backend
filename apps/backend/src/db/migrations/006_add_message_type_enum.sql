-- ============================================================
-- 006_add_message_type_enum.sql
-- Run this in: Supabase → SQL Editor → New Query → Run
--
-- BUG FIX: DB-2.2-V — message_type was unrestricted TEXT.
-- This migration creates a PostgreSQL ENUM type and applies
-- a CHECK constraint to restrict valid message_type values.
-- ============================================================

-- 1. Create the ENUM type (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'message_type_enum'
    ) THEN
        CREATE TYPE public.message_type_enum AS ENUM (
            'text',
            'image',
            'video',
            'audio',
            'file',
            'system'
        );
    END IF;
END
$$;

-- 2. Clean up any existing invalid data before applying constraint
--    Set any unrecognized values to the safe default 'text'
UPDATE public.message_relay
SET message_type = 'text'
WHERE message_type NOT IN ('text', 'image', 'video', 'audio', 'file', 'system');

-- 3. Alter the column to use the ENUM type
ALTER TABLE public.message_relay
    ALTER COLUMN message_type DROP DEFAULT;

ALTER TABLE public.message_relay
    ALTER COLUMN message_type
    TYPE public.message_type_enum
    USING message_type::public.message_type_enum;

ALTER TABLE public.message_relay
    ALTER COLUMN message_type SET DEFAULT 'text'::public.message_type_enum;

ALTER TABLE public.message_relay
    ALTER COLUMN message_type SET NOT NULL;

-- 4. Add a named CHECK constraint for clarity in pg_catalog
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_message_type_check
    CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file', 'system'));
