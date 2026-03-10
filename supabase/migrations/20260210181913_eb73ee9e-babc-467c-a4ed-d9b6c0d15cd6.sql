CREATE OR REPLACE FUNCTION public.get_orders_by_sku(p_store_id uuid, p_sku text, p_product_id text DEFAULT NULL)
RETURNS SETOF marketplace_orders
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT * FROM marketplace_orders
  WHERE store_id = p_store_id
  AND (
    items::jsonb @> ('[{"skuTitle":"' || p_sku || '"}]')::jsonb
    OR items::jsonb @> ('[{"offerId":"' || p_sku || '"}]')::jsonb
    OR (p_product_id IS NOT NULL AND items::jsonb @> ('[{"productId":' || p_product_id || '}]')::jsonb)
  )
  ORDER BY ordered_at DESC
  LIMIT 200;
$$;