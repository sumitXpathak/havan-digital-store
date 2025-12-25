-- Add explicit DENY policies for otp_store table
-- These policies deny all access to regular users; only service_role can bypass RLS
CREATE POLICY "Deny all access to otp_store"
ON public.otp_store
FOR ALL
USING (false)
WITH CHECK (false);

-- Add explicit DENY policies for rate_limits table
CREATE POLICY "Deny all access to rate_limits"
ON public.rate_limits
FOR ALL
USING (false)
WITH CHECK (false);