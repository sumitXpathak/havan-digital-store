-- Create wishlist table for users to save favorite products
CREATE TABLE public.wishlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Create policies for wishlist
CREATE POLICY "Users can view own wishlist" 
ON public.wishlist 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own wishlist" 
ON public.wishlist 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from own wishlist" 
ON public.wishlist 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX idx_wishlist_product_id ON public.wishlist(product_id);