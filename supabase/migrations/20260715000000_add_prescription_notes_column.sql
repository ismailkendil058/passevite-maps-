-- Add notes column to prescriptions if missing
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;
