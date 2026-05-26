-- One-time migration to add first admin user
-- Temporarily disable RLS to insert the first admin
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Insert the first admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('699bc48a-a778-457b-b204-5dbebb947439', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Re-enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;