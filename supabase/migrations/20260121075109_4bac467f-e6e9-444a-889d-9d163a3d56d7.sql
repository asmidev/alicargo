-- Add avg_daily_sales column to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS avg_daily_sales NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_forecast_date TIMESTAMP WITH TIME ZONE;

-- Create aggregated view for inventory indicators
CREATE OR REPLACE VIEW product_inventory_overview AS
SELECT 
  p.id,
  p.name,
  p.main_image_url,
  p.selling_price,
  p.avg_daily_sales,
  -- Yo'ldagi soni (in transit)
  (SELECT COUNT(*) FROM product_items pi 
   WHERE pi.product_id = p.id AND pi.status = 'in_transit') as in_transit_count,
  -- Toshkent omboridagi soni
  (SELECT COUNT(*) FROM product_items pi 
   WHERE pi.product_id = p.id 
   AND pi.location = 'uzbekistan' 
   AND pi.status IN ('in_stock', 'arrived')) as tashkent_count,
  -- Marketplace'lardagi soni
  COALESCE((SELECT SUM(ml.marketplace_stock) 
   FROM marketplace_listings ml 
   WHERE ml.product_id = p.id), 0) as marketplace_stock,
  -- Forecast ma'lumotlari
  (SELECT adf.predicted_units FROM ai_demand_forecasts adf 
   WHERE adf.product_id = p.id 
   ORDER BY adf.created_at DESC LIMIT 1) as predicted_demand,
  (SELECT adf.recommended_reorder_quantity FROM ai_demand_forecasts adf 
   WHERE adf.product_id = p.id 
   ORDER BY adf.created_at DESC LIMIT 1) as recommended_reorder
FROM products p
WHERE p.status = 'active';