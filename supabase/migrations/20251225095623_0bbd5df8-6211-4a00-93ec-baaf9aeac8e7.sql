-- Create products table for admin-managed products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hindi TEXT,
  description TEXT,
  features TEXT[],
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  category TEXT NOT NULL,
  badge TEXT,
  material TEXT,
  weight TEXT,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can view products (public catalog)
CREATE POLICY "Anyone can view products" 
ON public.products 
FOR SELECT 
USING (true);

-- Only admins can insert products
CREATE POLICY "Admins can insert products" 
ON public.products 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update products
CREATE POLICY "Admins can update products" 
ON public.products 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete products
CREATE POLICY "Admins can delete products" 
ON public.products 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for category lookups
CREATE INDEX idx_products_category ON public.products(category);

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Storage policies for product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));