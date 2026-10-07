-- Add 'in_cabinet' status to queue_entries
-- This enables a 2-step workflow:
-- 1. waiting -> in_cabinet (when "Suivant" is clicked)
-- 2. in_cabinet -> completed (when client details are filled)

ALTER TABLE public.queue_entries 
DROP CONSTRAINT IF EXISTS queue_entries_status_check,
ADD CONSTRAINT queue_entries_status_check 
CHECK (status IN ('waiting', 'in_cabinet', 'completed'));

-- Update any existing entries if needed (optional, no data migration needed as default is 'waiting')

