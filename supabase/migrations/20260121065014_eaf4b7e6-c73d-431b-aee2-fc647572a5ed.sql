-- Add shipping cost to China column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS shipping_cost_to_china NUMERIC DEFAULT NULL;

COMMENT ON COLUMN products.shipping_cost_to_china IS 'Xitoy omboriga yetkazish narxi (CNY)';