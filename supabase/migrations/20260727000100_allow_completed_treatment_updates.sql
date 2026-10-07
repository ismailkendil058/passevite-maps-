DROP POLICY IF EXISTS "Receptionist can update completed" ON public.completed_clients;

CREATE INDEX IF NOT EXISTS idx_completed_clients_phone_treatment
ON public.completed_clients (phone, treatment);

CREATE POLICY "Receptionist can update completed"
ON public.completed_clients
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));
