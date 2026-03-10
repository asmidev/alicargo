-- Add quantity column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Add selling_price for future marketplace use (optional for now)
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price NUMERIC;

-- Add comment to clarify price is buying price
COMMENT ON COLUMN products.price IS 'Buying price (sotib olish narxi) in USD';