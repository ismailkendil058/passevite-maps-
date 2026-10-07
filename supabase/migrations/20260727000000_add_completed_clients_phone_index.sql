CREATE INDEX IF NOT EXISTS idx_completed_clients_phone_completed_at
ON public.completed_clients (phone, completed_at DESC);
