-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS public.confirm_arrived_products(uuid[]);

-- Recreate confirm_arrived_products with defective/missing as valid completion statuses
CREATE OR REPLACE FUNCTION public.confirm_arrived_products(p_item_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  IF v_exchange_rate IS NULL THEN
    v_exchange_rate := 12800;
  END IF;

  -- Update items status to in_tashkent
  UPDATE product_items
  SET 
    status = 'in_tashkent',
    updated_at = now()
  WHERE id = ANY(p_item_ids)
    AND status = 'arrived_pending';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Increment tashkent_manual_stock and recalculate average cost_price for products
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
  
  -- Update variant cost_price with weighted average
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
  
  -- Auto-update box status when all items are in final states
  -- Final states: in_tashkent, sold, returned, defective, missing
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
      'in_tashkent',  -- Omborga qabul qilingan
      'sold',         -- Sotilgan
      'returned',     -- Qaytarilgan
      'defective',    -- Nuqsonli
      'missing'       -- Yo'qolgan
    )
  );
  
  RETURN json_build_object(
    'confirmed_count', v_count, 
    'exchange_rate', v_exchange_rate
  );
END;
$$;