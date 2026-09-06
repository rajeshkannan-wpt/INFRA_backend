-- ============================================================
-- 004_create_message_relay.sql
-- Run this in: Supabase → SQL Editor → New Query → Run
-- ============================================================

-- 1. Create the message_relay table
CREATE TABLE IF NOT EXISTS public.message_relay (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_device_id  uuid NOT NULL,
    recipient_user_id uuid,
    recipient_device_id uuid,
    recipient_group_id  uuid,
    ciphertext        bytea NOT NULL,
    message_type      text NOT NULL DEFAULT 'text',
    size_bytes        integer NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    expires_at        timestamptz NOT NULL,
    delivered_at      timestamptz,
    reply_to_id       uuid,
    voice_segment_group_id uuid
);

-- 2. CHECK constraint: exactly one recipient type must be set
--    (one of recipient_user_id, recipient_device_id, or recipient_group_id)
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_one_recipient_check
    CHECK (
        (recipient_user_id IS NOT NULL)::int
        + (recipient_device_id IS NOT NULL)::int
        + (recipient_group_id IS NOT NULL)::int
        = 1
    );

-- 3. Self-referencing FK for reply_to_id
ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_reply_to_fkey
    FOREIGN KEY (reply_to_id)
    REFERENCES public.message_relay (id)
    ON DELETE SET NULL;

-- 4. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_message_relay_recipient_user
    ON public.message_relay (recipient_user_id)
    WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_relay_recipient_device
    ON public.message_relay (recipient_device_id)
    WHERE recipient_device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_relay_recipient_group
    ON public.message_relay (recipient_group_id)
    WHERE recipient_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_relay_expires
    ON public.message_relay (expires_at);

CREATE INDEX IF NOT EXISTS idx_message_relay_created
    ON public.message_relay (created_at);

CREATE INDEX IF NOT EXISTS idx_message_relay_voice_group
    ON public.message_relay (voice_segment_group_id)
    WHERE voice_segment_group_id IS NOT NULL;

-- 5. Cleanup function: delete delivered OR expired messages
--    NOTE: RETURNS void (a sql-language DELETE can't return integer without RETURNING)
CREATE OR REPLACE FUNCTION public.cleanup_message_relay()
RETURNS void
LANGUAGE sql
AS $$
    DELETE FROM public.message_relay
    WHERE delivered_at IS NOT NULL
       OR expires_at < now();
$$;

-- 6. Enable pg_cron for scheduled cleanup (every 5 minutes)
--    NOTE: pg_cron must be enabled in Supabase dashboard:
--    Settings → Database → Extensions → enable "pg_cron"
--    The cron.schedule below is idempotent guard: only schedules if job not present.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-message-relay') THEN
        PERFORM cron.schedule(
            'cleanup-message-relay',
            '*/5 * * * *',
            $$ SELECT public.cleanup_message_relay(); $$
        );
    END IF;
END
$$;
