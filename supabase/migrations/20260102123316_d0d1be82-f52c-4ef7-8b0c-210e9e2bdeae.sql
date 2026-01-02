-- Fix public_reviews view: Make it read-only and explicitly restrict write access
-- Views don't support RLS, but we can control access via GRANT/REVOKE

-- Drop and recreate to ensure proper permissions
DROP VIEW IF EXISTS public.public_reviews;

CREATE VIEW public.public_reviews AS
SELECT 
  id,
  product_id,
  rating,
  comment,
  created_at,
  updated_at
FROM public.reviews;

-- Grant only SELECT access to make it read-only
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;

-- Explicitly revoke all write operations
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.public_reviews FROM public;

-- Add admin policies for reviews moderation
CREATE POLICY "Admins can view all reviews" 
ON public.reviews 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reviews for moderation" 
ON public.reviews 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));