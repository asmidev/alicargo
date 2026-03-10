
-- Phase 1: Drop old overloaded versions and rewrite the canonical function
-- Issue #2: Remove 2-arg and 3-arg overloads to prevent ambiguous resolution
-- Issue #1: Remove fulfillment_type filter (Uzum orders don't reliably distinguish FBS/FBU)
-- Issue #3: Increase LIMIT from 200 to 1000

-- Drop the 2-arg version
DROP FUNCTION IF EXISTS public.get_orders_by_sku(uuid, text);

-- Drop the 3-arg version
DROP FUNCTION IF EXISTS public.get_orders_by_sku(uuid, text, text);

-- Drop the 4-arg version (we'll recreate it)
DROP FUNCTION IF EXISTS public.get_orders_by_sku(uuid, text, text, text);

-- Recreate with 4 args but WITHOUT fulfillment_type filtering
-- The parameter is kept for API compatibility but ignored
CREATE OR REPLACE FUNCTION public.get_orders_by_sku(
  p_store_id uuid, 
  p_sku text, 
  p_product_id text DEFAULT NULL,
  p_fulfillment_type text DEFAULT NULL
)
RETURNS SETOF marketplace_orders
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT * FROM marketplace_orders
  WHERE store_id = p_store_id
  AND (
    items::jsonb @> ('[{"skuTitle":"' || p_sku || '"}]')::jsonb
    OR items::jsonb @> ('[{"offerId":"' || p_sku || '"}]')::jsonb
    OR (p_product_id IS NOT NULL AND items::jsonb @> ('[{"productId":' || p_product_id || '}]')::jsonb)
  )
  ORDER BY ordered_at DESC
  LIMIT 1000;
$function$;
