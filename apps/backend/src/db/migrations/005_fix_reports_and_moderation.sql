-- ============================================================
-- 005_fix_reports_and_moderation.sql
-- Fixes issues from DB-2.4-V and DB-2.5-V verification reports.
--
-- Fix 1 (DB-2.4-V): report_evidence must hold a privacy-minimized
--   bounded snapshot (jsonb) of decrypted message evidence, capped
--   at the smaller of: last 20 messages OR all messages from
--   last 7 days.
--
-- Fix 2 (DB-2.5-V): audit_log must use dashboard_admin_id,
--   report_id, and acted_at instead of admin_id/target_phone_hash/
--   created_at, with a FK to dashboard_admins and reports.
--
-- Fix 3 (DB-2.5-V): a transaction-safe moderation function
--   (warn/restrict/ban/dismiss) that writes both the state change
--   and the audit_log row in one transaction.
--
-- Run this in: Supabase → SQL Editor → New Query → Run
-- ============================================================

BEGIN;

-- ============================================================
-- FIX 1: report_evidence — add decrypted_message_snapshot (jsonb)
-- ============================================================

-- Add the jsonb snapshot column required by Tech Arch §6.6.
ALTER TABLE public.report_evidence
    ADD COLUMN IF NOT EXISTS decrypted_message_snapshot jsonb;

-- Make message_content nullable (legacy rows still hold it).
ALTER TABLE public.report_evidence
    ALTER COLUMN message_content DROP NOT NULL;

-- Index for lookups by report.
CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id
    ON public.report_evidence (report_id);

-- Add a snapshot column to the parent reports table as well, so the
-- bounded snapshot is retrievable even when no evidence rows exist.
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS decrypted_message_snapshot jsonb;

-- ============================================================
-- FIX 1b: Bounding enforcement
--   A) BEFORE INSERT trigger rejects rows that would exceed the
--      smaller-of-two-limits cap (newest 20 messages OR 7 days).
--   B) AFTER STATEMENT trigger rebuilds decrypted_message_snapshot
--      on the report AND every evidence row, so the jsonb snapshot
--      is verifiable and consistent (Issue 2 in DB-2.4-V).
-- ============================================================

-- A) BEFORE INSERT cap trigger: max 20 messages per report,
--    and message_created_at must be within the last 7 days.
CREATE OR REPLACE FUNCTION public.tg_report_evidence_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_report uuid := NEW.report_id;
    v_count  integer;
    v_since  timestamptz := now() - interval '7 days';
    v_7d_count integer;
    v_snapshot jsonb;
BEGIN
    -- 20-message cap (per report).
    SELECT COUNT(*) INTO v_count
    FROM public.report_evidence
    WHERE report_id = v_report;

    IF v_count >= 20 THEN
        RAISE EXCEPTION 'report evidence cap reached: % messages for report %', 20, v_report
            USING ERRCODE = 'P0001';
    END IF;

    -- 7-day window.
    IF NEW.message_created_at IS NOT NULL
       AND NEW.message_created_at < v_since THEN
        RAISE EXCEPTION 'evidence message is outside the 7-day bounding window'
            USING ERRCODE = 'P0001';
    END IF;

    -- Pre-populate the snapshot on the incoming row using the currently
    -- stored rows (the bounded set for this report so far).
    SELECT COUNT(*) INTO v_7d_count
    FROM public.report_evidence
    WHERE report_id = v_report
      AND (message_created_at IS NULL OR message_created_at >= v_since);

    SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
            'message_content',    m.message_content,
            'message_created_at', m.message_created_at,
            'captured_at',        m.captured_at
        ) ORDER BY COALESCE(m.message_created_at, m.captured_at) DESC),
        '[]'::jsonb
    )
    INTO NEW.decrypted_message_snapshot
    FROM (
        SELECT re.*
        FROM public.report_evidence re
        WHERE re.report_id = v_report
          AND (re.message_created_at IS NULL OR re.message_created_at >= v_since)
        ORDER BY COALESCE(re.message_created_at, re.captured_at) DESC
        LIMIT v_7d_count + 1
    ) m;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_evidence_cap ON public.report_evidence;
CREATE TRIGGER trg_report_evidence_cap
    BEFORE INSERT ON public.report_evidence
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_report_evidence_cap();

-- B) AFTER STATEMENT trigger: rebuild snapshots for every affected
--    report after any insert/delete, so report-level and row-level
--    snapshots stay consistent and reflect the exact bounded set.
CREATE OR REPLACE FUNCTION public.tg_backfill_report_snapshots()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_report uuid;
    v_since  timestamptz := now() - interval '7 days';
    v_snapshot jsonb;
BEGIN
    FOR v_report IN
        SELECT DISTINCT report_id FROM public.report_evidence
    LOOP
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object(
                'message_content',    m.message_content,
                'message_created_at', m.message_created_at,
                'captured_at',        m.captured_at
            ) ORDER BY COALESCE(m.message_created_at, m.captured_at) DESC),
            '[]'::jsonb
        )
        INTO v_snapshot
        FROM (
            SELECT re.*
            FROM public.report_evidence re
            WHERE re.report_id = v_report
              AND (re.message_created_at IS NULL OR re.message_created_at >= v_since)
            ORDER BY COALESCE(re.message_created_at, re.captured_at) DESC
            LIMIT 20
        ) m;

        UPDATE public.reports
        SET decrypted_message_snapshot = v_snapshot
        WHERE id = v_report;

        UPDATE public.report_evidence
        SET decrypted_message_snapshot = v_snapshot
        WHERE report_id = v_report;
    END LOOP;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_report_snapshots ON public.report_evidence;
CREATE TRIGGER trg_backfill_report_snapshots
    AFTER INSERT OR DELETE ON public.report_evidence
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.tg_backfill_report_snapshots();

-- Backfill existing evidence rows.
UPDATE public.report_evidence re
SET decrypted_message_snapshot =
    COALESCE(re.decrypted_message_snapshot, '[]'::jsonb);

-- ============================================================
-- FIX 1c: Mirror the same structure to the test tables.
-- ============================================================

ALTER TABLE public.test_report_evidence
    ADD COLUMN IF NOT EXISTS decrypted_message_snapshot jsonb;

ALTER TABLE public.test_report_evidence
    ALTER COLUMN message_content DROP NOT NULL;

ALTER TABLE public.test_reports
    ADD COLUMN IF NOT EXISTS decrypted_message_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.tg_test_report_evidence_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_report uuid := NEW.test_report_id;
    v_count  integer;
    v_since  timestamptz := now() - interval '7 days';
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.test_report_evidence
    WHERE test_report_id = v_report;

    IF v_count >= 20 THEN
        RAISE EXCEPTION 'report evidence cap reached: % messages for report %', 20, v_report
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.message_created_at IS NOT NULL
       AND NEW.message_created_at < v_since THEN
        RAISE EXCEPTION 'evidence message is outside the 7-day bounding window'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_report_evidence_cap ON public.test_report_evidence;
CREATE TRIGGER trg_test_report_evidence_cap
    BEFORE INSERT ON public.test_report_evidence
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_test_report_evidence_cap();

CREATE OR REPLACE FUNCTION public.tg_backfill_test_report_snapshots()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_report uuid;
    v_since  timestamptz := now() - interval '7 days';
    v_snapshot jsonb;
BEGIN
    FOR v_report IN
        SELECT DISTINCT test_report_id FROM public.test_report_evidence
    LOOP
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object(
                'message_content',    m.message_content,
                'message_created_at', m.message_created_at,
                'captured_at',        m.captured_at
            ) ORDER BY COALESCE(m.message_created_at, m.captured_at) DESC),
            '[]'::jsonb
        )
        INTO v_snapshot
        FROM (
            SELECT re.*
            FROM public.test_report_evidence re
            WHERE re.test_report_id = v_report
              AND (re.message_created_at IS NULL OR re.message_created_at >= v_since)
            ORDER BY COALESCE(re.message_created_at, re.captured_at) DESC
            LIMIT 20
        ) m;

        UPDATE public.test_reports
        SET decrypted_message_snapshot = v_snapshot
        WHERE id = v_report;

        UPDATE public.test_report_evidence
        SET decrypted_message_snapshot = v_snapshot
        WHERE test_report_id = v_report;
    END LOOP;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_test_report_snapshots ON public.test_report_evidence;
CREATE TRIGGER trg_backfill_test_report_snapshots
    AFTER INSERT OR DELETE ON public.test_report_evidence
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.tg_backfill_test_report_snapshots();

-- ============================================================
-- FIX 2: audit_log — align schema to the DB-2.5 spec
--   Expected: dashboard_admin_id, report_id, action, acted_at
-- ============================================================

-- Step 1: add the missing columns.
ALTER TABLE public.audit_log
    ADD COLUMN IF NOT EXISTS dashboard_admin_id uuid,
    ADD COLUMN IF NOT EXISTS report_id uuid;

-- Step 2: migrate data from legacy columns.
UPDATE public.audit_log
    SET dashboard_admin_id = admin_id
    WHERE dashboard_admin_id IS NULL AND admin_id IS NOT NULL;

-- Step 3: rename created_at to acted_at.
ALTER TABLE public.audit_log
    RENAME COLUMN created_at TO acted_at;

-- Step 4: drop legacy columns now that data is migrated.
ALTER TABLE public.audit_log
    DROP COLUMN IF EXISTS admin_id,
    DROP COLUMN IF EXISTS target_phone_hash;

-- Step 5: add FK constraints.
ALTER TABLE public.audit_log
    DROP CONSTRAINT IF EXISTS audit_log_dashboard_admin_fkey;

ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_dashboard_admin_fkey
    FOREIGN KEY (dashboard_admin_id)
    REFERENCES public.dashboard_admins (id)
    ON DELETE SET NULL;

ALTER TABLE public.audit_log
    DROP CONSTRAINT IF EXISTS audit_log_report_fkey;

ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_report_fkey
    FOREIGN KEY (report_id)
    REFERENCES public.reports (id)
    ON DELETE SET NULL;

-- ============================================================
-- FIX 3: Transaction-safe moderation function.
--   warn/restrict/ban/dismiss update the report + audit_log in
--   the SAME transaction — if the audit insert fails, the whole
--   action rolls back (Issue F-06 in DB-2.5-V).
-- ============================================================

CREATE OR REPLACE FUNCTION public.moderate_report(
    p_report_id      uuid,
    p_admin_id       uuid,
    p_action         public.audit_action
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_reported_hash text;
BEGIN
    -- Load the reported phone hash for this report.
    SELECT reported_phone_hash INTO v_reported_hash
    FROM public.reports
    WHERE id = p_report_id;

    IF v_reported_hash IS NULL THEN
        RAISE EXCEPTION 'report % not found', p_report_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Update the report row itself.
    UPDATE public.reports
    SET status = CASE p_action
            WHEN 'dismiss' THEN 'dismissed'::public.report_status
            ELSE 'actioned'::public.report_status
        END,
        actioned_at = now(),
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE id = p_report_id;

    -- Write the audit trail in the SAME transaction.
    -- If this insert fails, the entire statement rolls back
    -- (including the report UPDATE above).
    INSERT INTO public.audit_log (dashboard_admin_id, report_id, action, acted_at)
    VALUES (p_admin_id, p_report_id, p_action, now());

    RETURN;
END;
$$;

-- Wrappers for clarity.
CREATE OR REPLACE FUNCTION public.admin_warn(p_report_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE sql AS $$
    SELECT public.moderate_report(p_report_id, p_admin_id, 'warn');
$$;

CREATE OR REPLACE FUNCTION public.admin_restrict(p_report_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE sql AS $$
    SELECT public.moderate_report(p_report_id, p_admin_id, 'restrict');
$$;

CREATE OR REPLACE FUNCTION public.admin_ban(p_report_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE sql AS $$
    SELECT public.moderate_report(p_report_id, p_admin_id, 'ban');
$$;

CREATE OR REPLACE FUNCTION public.admin_dismiss(p_report_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE sql AS $$
    SELECT public.moderate_report(p_report_id, p_admin_id, 'dismiss');
$$;

COMMIT;

-- ============================================================
-- Verification queries (run after migration completes)
-- ============================================================

-- 1) report_evidence schema:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'report_evidence' ORDER BY ordinal_position;

-- 2) audit_log schema:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'audit_log' ORDER BY ordinal_position;

-- 3) Moderation functions:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name IN ('moderate_report','admin_warn','admin_restrict','admin_ban','admin_dismiss');