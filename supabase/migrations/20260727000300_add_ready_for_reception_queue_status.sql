ALTER TABLE public.queue_entries
DROP CONSTRAINT IF EXISTS queue_entries_status_check;

ALTER TABLE public.queue_entries
ADD CONSTRAINT queue_entries_status_check
CHECK (status IN ('waiting', 'in_cabinet', 'ready_for_reception', 'completed'));

DROP INDEX IF EXISTS queue_entries_phone_active_idx;

CREATE UNIQUE INDEX queue_entries_phone_active_idx
ON public.queue_entries (phone)
WHERE (status IN ('waiting', 'in_cabinet', 'ready_for_reception'));
