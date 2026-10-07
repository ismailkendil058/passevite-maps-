-- Drop the foreign key constraint that references the obsolete auth.users table
-- Since the application now uses a custom `roles` table for authentication, 
-- receptionist_id is no longer an auth.users UUID but a public.roles UUID.

ALTER TABLE public.completed_clients 
DROP CONSTRAINT IF EXISTS completed_clients_receptionist_id_fkey;
