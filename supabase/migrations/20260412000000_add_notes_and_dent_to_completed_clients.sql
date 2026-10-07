ALTER TABLE public.completed_clients ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.completed_clients ADD COLUMN IF NOT EXISTS numero_dent varchar(255);
