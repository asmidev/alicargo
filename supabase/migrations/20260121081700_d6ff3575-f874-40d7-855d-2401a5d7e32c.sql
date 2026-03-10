-- Drop existing view and recreate with all required columns
DROP VIEW IF EXISTS product_inventory_overview;

CREATE VIEW product_inventory_overview AS
SELECT 
  p.id,
  p.name,
  p.main_image_url,
  p.selling_price,
  p.avg_daily_sales,
  p.tashkent_manual_stock,
  
  -- In-transit count from product_items
  COALESCE((
    SELECT COUNT(*)::INTEGER 
    FROM product_items pi 
    WHERE pi.product_id = p.id 
    AND pi.status = 'in_transit'
  ), 0) as in_transit_count,
  
  -- Tashkent warehouse count - simplified using tashkent_manual_stock
  -- Also count product_items with Tashkent-related statuses as fallback
  COALESCE((
    SELECT COUNT(*)::INTEGER 
    FROM product_items pi 
    WHERE pi.product_id = p.id 
    AND pi.status IN ('in_stock', 'available', 'arrived', 'received')
  ), 0) as tashkent_count,
  
  -- Marketplace stock from integrations (Yandex + Uzum)
  COALESCE((
    SELECT SUM(ml.marketplace_stock)::INTEGER 
    FROM marketplace_listings ml 
    WHERE ml.product_id = p.id 
    AND ml.status = 'active'
  ), 0) as marketplace_stock,
  
  -- Marketplace stock breakdown by platform (as JSON)
  (
    SELECT jsonb_object_agg(ml.marketplace, ml.total_stock)
    FROM (
      SELECT marketplace::text, SUM(marketplace_stock) as total_stock
      FROM marketplace_listings
      WHERE product_id = p.id AND status = 'active'
      GROUP BY marketplace
    ) ml
  ) as marketplace_breakdown,
  
  -- AI forecast data - predicted demand
  (
    SELECT adf.predicted_units 
    FROM ai_demand_forecasts adf 
    WHERE adf.product_id = p.id 
    ORDER BY adf.created_at DESC 
    LIMIT 1
  ) as predicted_demand,
  
  -- AI forecast data - recommended reorder quantity
  (
    SELECT adf.recommended_reorder_quantity 
    FROM ai_demand_forecasts adf 
    WHERE adf.product_id = p.id 
    ORDER BY adf.created_at DESC 
    LIMIT 1
  ) as recommended_reorder,
  
  -- AI forecast data - calculated average daily sales
  (
    SELECT (adf.factors->>'avg_daily_sales')::NUMERIC 
    FROM ai_demand_forecasts adf 
    WHERE adf.product_id = p.id 
    ORDER BY adf.created_at DESC 
    LIMIT 1
  ) as calculated_avg_daily_sales,
  
  -- AI forecast data - days until stockout
  (
    SELECT (adf.factors->>'days_until_stockout')::INTEGER 
    FROM ai_demand_forecasts adf 
    WHERE adf.product_id = p.id 
    ORDER BY adf.created_at DESC 
    LIMIT 1
  ) as days_until_stockout,
  
  -- AI forecast data - optimal reorder date
  (
    SELECT adf.optimal_reorder_date 
    FROM ai_demand_forecasts adf 
    WHERE adf.product_id = p.id 
    ORDER BY adf.created_at DESC 
    LIMIT 1
  ) as optimal_reorder_date

FROM products p
WHERE p.status IN ('active', 'arrived', 'pending');