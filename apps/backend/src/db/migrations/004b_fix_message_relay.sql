-- Run this in: Supabase → SQL Editor → New Query → Run

-- 1. Add the missing reply_to_id column
ALTER TABLE public.message_relay
    ADD COLUMN IF NOT EXISTS reply_to_id uuid;

-- 2. Now add the self-referencing FK (dropped first so the script is re-runnable)
ALTER TABLE public.message_relay
    DROP CONSTRAINT IF EXISTS message_relay_reply_to_fkey;

ALTER TABLE public.message_relay
    ADD CONSTRAINT message_relay_reply_to_fkey
    FOREIGN KEY (reply_to_id)
    REFERENCES public.message_relay (id)
    ON DELETE SET NULL;

-- 3. Add the missing voice_segment_group_id column
ALTER TABLE public.message_relay
    ADD COLUMN IF NOT EXISTS voice_segment_group_id uuid;

-- 4. Index for voice segment group lookups
CREATE INDEX IF NOT EXISTS idx_message_relay_voice_group
    ON public.message_relay (voice_segment_group_id)
    WHERE voice_segment_group_id IS NOT NULL;
