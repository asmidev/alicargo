-- Add variant_id column to product_items table to link items to specific variants
ALTER TABLE public.product_items 
ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_product_items_variant_id ON public.product_items(variant_id);