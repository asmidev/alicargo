-- Step 1: Add tashkent_manual_stock column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tashkent_manual_stock INTEGER DEFAULT 0;