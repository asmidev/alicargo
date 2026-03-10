CREATE OR REPLACE FUNCTION public.confirm_arrived_products(p_item_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE product_items
  SET 
    status = 'in_tashkent',
    updated_at = now()
  WHERE id = ANY(p_item_ids)
    AND status = 'arrived_pending';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also increment tashkent_manual_stock for each product and set status to active
  UPDATE products p
  SET 
    tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + counts.cnt,
    status = 'active'
  FROM (
    SELECT product_id, COUNT(*) as cnt
    FROM product_items
    WHERE id = ANY(p_item_ids)
    GROUP BY product_id
  ) counts
  WHERE p.id = counts.product_id;
  
  RETURN json_build_object('confirmed_count', v_count);
END;
$function$