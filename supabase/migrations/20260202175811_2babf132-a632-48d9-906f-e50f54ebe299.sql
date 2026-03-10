-- Fix Plan: Database Migration for Marketplace Health

-- 1. Add index for faster commission updates by external_order_id
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_store_external_id 
ON marketplace_orders(store_id, external_order_id);

-- 2. Add link_strategy column to track how listings were linked
ALTER TABLE marketplace_listings 
ADD COLUMN IF NOT EXISTS link_strategy TEXT;
-- Values will be: 'barcode', 'sku', 'title', 'manual'

COMMENT ON COLUMN marketplace_listings.link_strategy IS 'How the listing was linked to a product: barcode, sku, title (fuzzy), or manual';

-- 3. Update fulfillment_status mapping for existing Uzum orders
-- This normalizes COMPLETED and DELIVERED statuses to 'delivered' for finance calculations
UPDATE marketplace_orders 
SET fulfillment_status = 'delivered'
WHERE status IN ('COMPLETED', 'DELIVERED') 
AND (fulfillment_status IS NULL OR fulfillment_status NOT IN ('delivered', 'returned', 'cancelled'));

-- 4. Create function to suggest products from listings for manual linking
CREATE OR REPLACE FUNCTION suggest_products_from_listings()
RETURNS TABLE (
  suggested_name TEXT,
  external_barcode TEXT,
  external_sku TEXT,
  listing_count BIGINT,
  store_names TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ml.title as suggested_name,
    ml.external_barcode,
    ml.external_sku,
    COUNT(*)::BIGINT as listing_count,
    STRING_AGG(DISTINCT ms.name, ', ') as store_names
  FROM marketplace_listings ml
  JOIN marketplace_stores ms ON ml.store_id = ms.id
  WHERE ml.product_id IS NULL
  GROUP BY ml.title, ml.external_barcode, ml.external_sku
  ORDER BY listing_count DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;