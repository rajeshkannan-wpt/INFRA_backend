-- ============================================================
-- 009_fix_contact_hashes_add_created_at.sql
-- Run this in: Supabase -> SQL Editor -> New Query -> Run
--
-- DB-2.3-V Fix: Add missing created_at column to contact_hashes.
-- The Drizzle schema defines this column, but it was missing from
-- the live table (confirmed via information_schema query).
--
-- This script is IDEMPOTENT — safe to re-run.
-- ============================================================

-- Add created_at column if it doesn't exist
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
