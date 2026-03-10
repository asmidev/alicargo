-- Add cost_price column for product cost (tannarx)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric;

-- Add comment
COMMENT ON COLUMN products.cost_price IS 'Mahsulot tannarxi (so''m)';
