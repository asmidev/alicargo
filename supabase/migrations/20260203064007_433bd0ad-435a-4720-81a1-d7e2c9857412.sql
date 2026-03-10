-- Add cost_price and cost_price_currency columns to product_variants table
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC,
ADD COLUMN IF NOT EXISTS cost_price_currency TEXT DEFAULT 'CNY';

-- Add comment for clarity
COMMENT ON COLUMN product_variants.cost_price IS 'Purchase cost price for this specific variant';
COMMENT ON COLUMN product_variants.cost_price_currency IS 'Currency for the cost price (CNY, USD, UZS)';