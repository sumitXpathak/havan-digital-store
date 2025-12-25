-- Drop the existing policy and create a more secure one
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

-- Create a secure policy that ensures users can ONLY view their own orders
CREATE POLICY "Users can view own orders" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);