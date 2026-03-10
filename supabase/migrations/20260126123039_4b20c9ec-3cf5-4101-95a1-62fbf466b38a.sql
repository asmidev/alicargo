-- Add tashkent_section column to products table for storing warehouse section number
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tashkent_section TEXT;