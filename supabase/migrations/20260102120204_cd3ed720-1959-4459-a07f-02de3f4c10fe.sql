-- Create a view for public reviews that excludes user_id for privacy
CREATE OR REPLACE VIEW public.public_reviews AS
SELECT 
  id,
  product_id,
  rating,
  comment,
  created_at,
  updated_at
FROM public.reviews;

-- Grant access to the view
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;