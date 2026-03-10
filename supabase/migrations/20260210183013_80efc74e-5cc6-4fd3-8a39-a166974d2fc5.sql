
CREATE OR REPLACE FUNCTION public.get_orders_by_sku(p_store_id uuid, p_sku text, p_product_id text DEFAULT NULL::text, p_fulfillment_type text DEFAULT NULL::text)
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
  AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type)
  ORDER BY ordered_at DESC
  LIMIT 200;
$function$;
