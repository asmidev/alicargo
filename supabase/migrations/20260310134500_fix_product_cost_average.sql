-- Fix confirm_arrived_products to correctly average product cost_price with existing stock
-- Previously it only took the AVG of all product_items, which ignored manually added stock and older items missing product_items.

CREATE OR REPLACE FUNCTION public.confirm_arrived_products(p_item_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_exchange_rate numeric;
BEGIN
  SELECT (rates->>'UZS')::numeric INTO v_exchange_rate
  FROM exchange_rates_history
  WHERE base_currency = 'USD'
  ORDER BY fetched_at DESC
  LIMIT 1;
  
  IF v_exchange_rate IS NULL THEN
    v_exchange_rate := 12800;
  END IF;

  UPDATE product_items
  SET 
    status = 'in_tashkent',
    updated_at = now()
  WHERE id = ANY(p_item_ids)
    AND status = 'arrived_pending';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- UPDATE PRODUCTS WITH WEIGHTED AVERAGE COST
  UPDATE products p
  SET 
    cost_price = ROUND(
      (
        COALESCE(p.cost_price, 0) * COALESCE(p.tashkent_manual_stock, 0) + 
        counts.total_new_cost
      ) / NULLIF(COALESCE(p.tashkent_manual_stock, 0) + counts.item_count, 0)
    ),
    tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + counts.item_count,
    status = 'active'
  FROM (
    SELECT 
      product_id, 
      COUNT(*) as item_count,
      SUM(COALESCE(final_cost_usd, 0) * v_exchange_rate) as total_new_cost
    FROM product_items
    WHERE id = ANY(p_item_ids)
    GROUP BY product_id
  ) counts
  WHERE p.id = counts.product_id;
  
  -- UPDATE VARIANTS WITH WEIGHTED AVERAGE COST
  UPDATE product_variants pv
  SET cost_price = ROUND(
    (
      COALESCE(pv.cost_price, 0) * COALESCE(pv.stock_quantity, 0) + 
      new_costs.total_cost
    ) / NULLIF(COALESCE(pv.stock_quantity, 0) + new_costs.item_count, 0)
  ),
  stock_quantity = COALESCE(pv.stock_quantity, 0) + new_costs.item_count
  FROM (
    SELECT 
      pi.variant_id,
      COUNT(*) as item_count,
      SUM(COALESCE(pi.final_cost_usd, 0) * v_exchange_rate) as total_cost
    FROM product_items pi
    WHERE pi.id = ANY(p_item_ids)
      AND pi.variant_id IS NOT NULL
    GROUP BY pi.variant_id
  ) new_costs
  WHERE pv.id = new_costs.variant_id;
  
  -- UPDATE BOX STATUS
  UPDATE boxes b
  SET 
    status = 'arrived',
    location = 'uzbekistan',
    actual_arrival = COALESCE(b.actual_arrival, now())
  WHERE b.id IN (
    SELECT DISTINCT pi.box_id 
    FROM product_items pi 
    WHERE pi.id = ANY(p_item_ids) AND pi.box_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM product_items pi2 
    WHERE pi2.box_id = b.id 
    AND pi2.status NOT IN (
      'in_tashkent',
      'sold',
      'returned',
      'defective',
      'missing'
    )
  );
  
  RETURN json_build_object(
    'confirmed_count', v_count, 
    'exchange_rate', v_exchange_rate
  );
END;
$$;
