CREATE OR REPLACE FUNCTION get_orders_by_sku(p_store_id uuid, p_sku text)
RETURNS SETOF marketplace_orders AS $$
  SELECT * FROM marketplace_orders
  WHERE store_id = p_store_id
  AND (
    items::jsonb @> ('[{"skuTitle":"' || p_sku || '"}]')::jsonb
    OR items::jsonb @> ('[{"offerId":"' || p_sku || '"}]')::jsonb
  )
  ORDER BY ordered_at DESC
  LIMIT 200;
$$ LANGUAGE sql STABLE SET search_path = public;