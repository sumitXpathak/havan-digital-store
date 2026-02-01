-- Fix 1: Add length constraint to reviews.comment
ALTER TABLE public.reviews 
ADD CONSTRAINT comment_length_check 
CHECK (comment IS NULL OR char_length(comment) <= 1000);

-- Fix 2: Recreate public_reviews view with security_invoker to respect RLS
DROP VIEW IF EXISTS public.public_reviews;

CREATE VIEW public.public_reviews 
WITH (security_invoker = on) AS
SELECT 
  id,
  product_id,
  rating,
  comment,
  created_at,
  updated_at
FROM public.reviews;

-- Add permissive SELECT policy on reviews for public access to reviews
CREATE POLICY "Anyone can view reviews" 
ON public.reviews 
FOR SELECT 
USING (true);