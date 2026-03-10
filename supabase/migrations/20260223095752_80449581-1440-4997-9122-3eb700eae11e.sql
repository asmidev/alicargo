
CREATE OR REPLACE FUNCTION public.auto_distribute_box_shipping_cost(p_box_id uuid, p_shipping_cost numeric, p_volume_m3 numeric DEFAULT 0, p_usd_to_uzs numeric DEFAULT 12800)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_weight NUMERIC := 0;
  item_count INTEGER := 0;
  per_item_volume NUMERIC;
  per_item_shipping NUMERIC;
  shipping_per_unit_uzs NUMERIC;
  updated_count INTEGER := 0;
  distribution_method TEXT := 'equal';
  item_record RECORD;
  prod_record RECORD;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(COALESCE(pi.weight_grams, pv.weight, 0)), 0)
  INTO item_count, total_weight
  FROM public.product_items pi
  LEFT JOIN public.product_variants pv ON pi.variant_id = pv.id
  WHERE pi.box_id = p_box_id;

  IF item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Qutida mahsulot topilmadi', 'updated', 0);
  END IF;

  per_item_volume := COALESCE(p_volume_m3, 0) / item_count;

  -- ===== STEP 1: Subtract OLD shipping from products.cost_price (per unique product) =====
  FOR prod_record IN
    SELECT DISTINCT pi.product_id,
           AVG(COALESCE(pi.international_shipping_cost, 0)) AS avg_old_shipping,
           AVG(COALESCE((pi.cost_breakdown->>'usd_to_uzs_rate')::numeric, p_usd_to_uzs)) AS old_rate
    FROM public.product_items pi
    WHERE pi.box_id = p_box_id
    GROUP BY pi.product_id
  LOOP
    UPDATE public.products
    SET cost_price = GREATEST(COALESCE(cost_price, 0) - ROUND(prod_record.avg_old_shipping * prod_record.old_rate, 0), 0)
    WHERE id = prod_record.product_id;
  END LOOP;

  -- ===== STEP 2: Update each product_item =====
  IF total_weight > 0 THEN
    distribution_method := 'by_weight';

    FOR item_record IN 
      SELECT pi.id, pi.product_id, pi.unit_cost_usd, pi.domestic_shipping_cost, 
             pi.exchange_rate_at_purchase,
             COALESCE(pi.weight_grams, pv.weight, 0) AS eff_weight
      FROM public.product_items pi
      LEFT JOIN public.product_variants pv ON pi.variant_id = pv.id
      WHERE pi.box_id = p_box_id
    LOOP
      per_item_shipping := (item_record.eff_weight / total_weight) * COALESCE(p_shipping_cost, 0);
      shipping_per_unit_uzs := per_item_shipping * p_usd_to_uzs;

      UPDATE public.product_items 
      SET 
        volume_m3 = per_item_volume,
        international_shipping_cost = per_item_shipping,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'international_shipping', per_item_shipping,
            'distribution_method', 'by_weight',
            'weight_grams', item_record.eff_weight,
            'weight_ratio', ROUND((item_record.eff_weight / total_weight)::numeric, 4),
            'shipping_per_unit_uzs', ROUND(shipping_per_unit_uzs::numeric, 0),
            'usd_to_uzs_rate', p_usd_to_uzs,
            'distributed_at', now()
          ),
        final_cost_usd = COALESCE(item_record.unit_cost_usd, 0) + 
          (COALESCE(item_record.domestic_shipping_cost, 0) / COALESCE(NULLIF(item_record.exchange_rate_at_purchase, 0), 7.25)) + 
          per_item_shipping
      WHERE id = item_record.id;

      updated_count := updated_count + 1;
    END LOOP;
  ELSE
    distribution_method := 'equal';
    per_item_shipping := COALESCE(p_shipping_cost, 0) / item_count;
    shipping_per_unit_uzs := per_item_shipping * p_usd_to_uzs;

    FOR item_record IN 
      SELECT pi.id, pi.product_id, pi.unit_cost_usd, pi.domestic_shipping_cost, 
             pi.exchange_rate_at_purchase
      FROM public.product_items pi
      WHERE pi.box_id = p_box_id
    LOOP
      UPDATE public.product_items 
      SET 
        volume_m3 = per_item_volume,
        international_shipping_cost = per_item_shipping,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'international_shipping', per_item_shipping,
            'distribution_method', 'equal',
            'shipping_per_unit_uzs', ROUND(shipping_per_unit_uzs::numeric, 0),
            'usd_to_uzs_rate', p_usd_to_uzs,
            'distributed_at', now()
          ),
        final_cost_usd = COALESCE(item_record.unit_cost_usd, 0) + 
          (COALESCE(item_record.domestic_shipping_cost, 0) / COALESCE(NULLIF(item_record.exchange_rate_at_purchase, 0), 7.25)) + 
          per_item_shipping
      WHERE id = item_record.id;

      updated_count := updated_count + 1;
    END LOOP;
  END IF;

  -- ===== STEP 3: Add NEW shipping to products.cost_price (per unique product, once) =====
  FOR prod_record IN
    SELECT DISTINCT pi.product_id,
           AVG(pi.international_shipping_cost) AS avg_new_shipping
    FROM public.product_items pi
    WHERE pi.box_id = p_box_id
    GROUP BY pi.product_id
  LOOP
    UPDATE public.products
    SET cost_price = COALESCE(cost_price, 0) + ROUND(prod_record.avg_new_shipping * p_usd_to_uzs, 0)
    WHERE id = prod_record.product_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Yo''l haqqi taqsimlandi (' || distribution_method || ')',
    'updated', updated_count,
    'method', distribution_method,
    'total_weight_grams', total_weight,
    'usd_to_uzs', p_usd_to_uzs,
    'total_shipping_usd', p_shipping_cost
  );
END;
$function$;
