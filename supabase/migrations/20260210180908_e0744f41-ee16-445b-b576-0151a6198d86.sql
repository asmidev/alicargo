
CREATE OR REPLACE FUNCTION public.get_orders_by_sku(p_store_id uuid, p_sku text)
RETURNS SETOF marketplace_orders AS $$
  SELECT * FROM marketplace_orders
  WHERE store_id = p_store_id
  AND items::jsonb @> ('[{"skuTitle":"' || p_sku || '"}]')::jsonb
  ORDER BY ordered_at DESC
  LIMIT 200;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
