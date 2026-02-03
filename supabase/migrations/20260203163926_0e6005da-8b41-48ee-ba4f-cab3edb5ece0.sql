-- First, drop existing policies that reference the old column type
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Drop the foreign key constraint if it exists
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Change the user_id column from UUID to TEXT to support Clerk user IDs
ALTER TABLE public.user_roles ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Recreate the has_role function to accept TEXT instead of UUID
CREATE OR REPLACE FUNCTION public.has_role(_user_id TEXT, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate RLS policies for user_roles table
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid()::TEXT, 'admin'))
WITH CHECK (has_role(auth.uid()::TEXT, 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid()::TEXT = user_id);

-- Now insert the admin role for the user
INSERT INTO public.user_roles (user_id, role)
VALUES ('user_394ojzQGIrkwkvHPjt79momfIX2', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;