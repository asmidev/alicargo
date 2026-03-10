-- Update confirm_arrived_products to also calculate cost_price from avg final_cost_usd
CREATE OR REPLACE FUNCTION public.confirm_arrived_products(p_item_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_exchange_rate numeric;
BEGIN
  -- Get latest USD to UZS exchange rate
  SELECT (rates->>'UZS')::numeric INTO v_exchange_rate
  FROM exchange_rates_history
  WHERE base_currency = 'USD'
  ORDER BY fetched_at DESC
  LIMIT 1;
  
  -- Default rate if not found
  IF v_exchange_rate IS NULL THEN
    v_exchange_rate := 12800;
  END IF;

  -- Update items status
  UPDATE product_items
  SET 
    status = 'in_tashkent',
    updated_at = now()
  WHERE id = ANY(p_item_ids)
    AND status = 'arrived_pending';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Increment tashkent_manual_stock, set status to active, and calculate cost_price from avg final_cost_usd
  UPDATE products p
  SET 
    tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + counts.cnt,
    status = 'active',
    cost_price = COALESCE(
      (
        SELECT ROUND(AVG(final_cost_usd) * v_exchange_rate)
        FROM product_items
        WHERE product_id = p.id AND final_cost_usd IS NOT NULL
      ),
      p.cost_price
    )
  FROM (
    SELECT product_id, COUNT(*) as cnt
    FROM product_items
    WHERE id = ANY(p_item_ids)
    GROUP BY product_id
  ) counts
  WHERE p.id = counts.product_id;
  
  RETURN json_build_object('confirmed_count', v_count, 'exchange_rate', v_exchange_rate);
END;
$function$;