-- Update reviews table: remove public read access, force use of public_reviews view
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;

-- Only allow reading reviews through the public_reviews view (which excludes user_id)
-- Users can still see their own reviews for editing purposes
CREATE POLICY "Users can view own reviews" 
ON public.reviews 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add explicit RLS policy to public_reviews view is not needed since views inherit from base table
-- But we need to ensure the view is accessible - it already has GRANT SELECT