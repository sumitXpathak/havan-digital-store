-- Fix public_reviews view to use SECURITY INVOKER (not DEFINER)
-- This ensures queries run with the caller's permissions, not the view creator's

DROP VIEW IF EXISTS public.public_reviews;

-- Create view with SECURITY INVOKER to inherit caller's RLS permissions
CREATE VIEW public.public_reviews 
WITH (security_invoker = true)
AS
SELECT 
  id,
  product_id,
  rating,
  comment,
  created_at,
  updated_at
FROM public.reviews;

-- Grant read-only access
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;

-- Explicitly revoke all write operations
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM public;