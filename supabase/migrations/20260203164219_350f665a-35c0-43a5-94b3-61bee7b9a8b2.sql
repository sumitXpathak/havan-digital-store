-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Create a simple SELECT policy that allows anyone to check roles
-- This is safe because the table only contains user_id and role mappings
CREATE POLICY "Anyone can read roles for auth check"
ON public.user_roles
FOR SELECT
USING (true);

-- Only allow admins to insert/update/delete roles (via edge function with service role)
-- No direct client-side mutation policies needed since admin management
-- should be done through edge functions with service role key