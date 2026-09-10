-- ============================================================
-- 010_add_groups_schema.sql
-- DB-2.1-V remediation — bring groups / group_members into the
-- repo as reproducible SQL and fix sender_key_epoch DEFAULT.
--
-- Background (found during independent DB-2.1-V verification):
--   * The groups + group_members tables existed ONLY in the live
--     Supabase DB — there was no schema/migration anywhere in this
--     repo, so a fresh environment could not reproduce them.
--   * groups.sender_key_epoch was integer NOT NULL but had a NULL
--     default, whereas Tech Arch §6.3 and the DB-2.1 card require
--     DEFAULT 0.
--
-- This script is IDEMPOTENT — safe to re-run in Supabase → SQL Editor.
--
-- Matches Tech Arch §6.3 exactly:
--   groups:        id uuid PK, encrypted_name bytea NOT NULL,
--                  encrypted_icon_ref bytea NULL, encrypted_description
--                  bytea NULL, who_can_send enum default everyone,
--                  sender_key_epoch integer NOT NULL default 0,
--                  created_at timestamptz default now()
--   group_members: group_id+user_id composite PK, role enum
--                  (owner/admin/member), joined_at timestamptz
-- NOTE: NO who_can_edit_info toggle by design (Tech Arch §13.3).
-- ============================================================

-- ── 1. Enums (only if not already present) ────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'who_can_send') THEN
        CREATE TYPE public.who_can_send AS ENUM ('everyone', 'admins_only');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_member_role') THEN
        CREATE TYPE public.group_member_role AS ENUM ('owner', 'admin', 'member');
    END IF;
END
$$;

-- ── 2. groups table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encrypted_name         bytea NOT NULL,
    encrypted_icon_ref     bytea,
    encrypted_description  bytea,
    who_can_send           public.who_can_send NOT NULL DEFAULT 'everyone',
    sender_key_epoch       integer NOT NULL DEFAULT 0,
    created_at             timestamptz NOT NULL DEFAULT now()
);

-- ── 3. group_members table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id   uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES public.users  (id) ON DELETE CASCADE,
    role       public.group_member_role NOT NULL DEFAULT 'member',
    joined_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

-- ── 4. Fix sender_key_epoch DEFAULT (was NULL) ────────────────
-- Tech Arch §6.3 / DB-2.1 card: sender_key_epoch must default to 0.
-- Idempotent: guards on the current default before altering.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'groups'
          AND column_name = 'sender_key_epoch'
          AND (column_default IS NULL OR column_default <> '0')
    ) THEN
        ALTER TABLE public.groups
            ALTER COLUMN sender_key_epoch SET DEFAULT 0;
    END IF;
END
$$;

-- ── 5. Indexes (natural lookup paths) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_members_user
    ON public.group_members (user_id);
