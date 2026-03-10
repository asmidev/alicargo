
-- 1. Add price_source column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_source TEXT DEFAULT 'manual';

-- 2. Backfill selling_price from marketplace listings
-- Strategy: for each product, pick the price from the store with most orders.
-- If no orders data, use the median price across listings.
WITH listing_prices AS (
  SELECT 
    ml.product_id,
    ml.price,
    ml.store_id,
    COALESCE(
      (SELECT COUNT(*) FROM marketplace_orders mo WHERE mo.store_id = ml.store_id AND mo.fulfillment_status = 'delivered'),
      0
    ) as store_order_count
  FROM marketplace_listings ml
  WHERE ml.product_id IS NOT NULL 
    AND ml.price IS NOT NULL 
    AND ml.price > 0
    AND ml.status = 'active'
),
ranked AS (
  SELECT 
    product_id,
    price,
    store_order_count,
    ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY store_order_count DESC, price ASC) as rn,
    MIN(price) OVER (PARTITION BY product_id) as min_price,
    MAX(price) OVER (PARTITION BY product_id) as max_price
  FROM listing_prices
),
best_price AS (
  SELECT 
    product_id,
    price as selected_price,
    CASE 
      WHEN max_price > 0 AND min_price > 0 
        THEN ROUND(((max_price - min_price)::numeric / min_price) * 100)
      ELSE 0 
    END as price_variance_pct
  FROM ranked
  WHERE rn = 1
)
UPDATE public.products p
SET 
  selling_price = bp.selected_price,
  price_source = 'marketplace_auto'
FROM best_price bp
WHERE p.id = bp.product_id
  AND p.selling_price IS NULL
  AND p.tashkent_manual_stock > 0;
