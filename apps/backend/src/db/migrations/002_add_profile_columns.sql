-- Migration: add photo, about, updated_at to users table.
-- Run once against the existing database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;
