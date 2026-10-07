-- Migration to add handoff fields from doctor to reception
ALTER TABLE public.queue_entries ADD COLUMN IF NOT EXISTS treatment TEXT;
ALTER TABLE public.queue_entries ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE public.queue_entries ADD COLUMN IF NOT EXISTS handoff_notes TEXT;
