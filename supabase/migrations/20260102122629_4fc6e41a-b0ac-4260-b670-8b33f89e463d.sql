-- Enable RLS on public_reviews view (views inherit from base table when using security_invoker)
-- Since public_reviews uses security_invoker=true, it inherits RLS from the base reviews table
-- But we need to explicitly enable RLS on the view as well

-- Drop and recreate the view with proper settings
DROP VIEW IF EXISTS public.public_reviews;

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

-- Grant SELECT only (no INSERT/UPDATE/DELETE) to prevent modifications
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;

-- Revoke any other permissions that might exist
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM authenticated;