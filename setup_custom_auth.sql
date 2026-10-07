-- 1. CLEANUP: Drop old auth-related tables
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.profiles;

-- 2. CREATE NEW ROLES TABLE
-- This table will handle manual authentication
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- In a production app, this should be hashed
    role TEXT NOT NULL CHECK (role IN ('manager', 'receptionist')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SEED INITIAL USERS
-- Password: admin123 and accueil123
INSERT INTO public.roles (username, password, role)
VALUES 
    ('admin', 'admin123', 'manager'),
    ('accueil', 'accueil123', 'receptionist');

-- 4. PERMISSIONS
-- Since we are bypassing Supabase Auth, we make this table accessible
-- Note: In a real app, you would use RLS and functions to hide passwords
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for login" ON public.roles FOR SELECT USING (true);
