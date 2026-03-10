
-- Drop old 2-param version (no longer needed)
DROP FUNCTION IF EXISTS public.auto_distribute_box_shipping_cost(uuid, numeric);

-- Recreate 3-param version with weight-based distribution + cost_price update in UZS
CREATE OR REPLACE FUNCTION public.auto_distribute_box_shipping_cost(
  p_box_id uuid, 
  p_shipping_cost numeric, 
  p_volume_m3 numeric DEFAULT 0,
  p_usd_to_uzs numeric DEFAULT 12800
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  -- Count items and total weight (weight_grams from product_items, fallback to product_variants.weight)
  SELECT COUNT(*), COALESCE(SUM(COALESCE(pi.weight_grams, pv.weight, 0)), 0)
  INTO item_count, total_weight
  FROM public.product_items pi
  LEFT JOIN public.product_variants pv ON pi.variant_id = pv.id
  WHERE pi.box_id = p_box_id;

  IF item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Qutida mahsulot topilmadi', 'updated', 0);
  END IF;

  per_item_volume := COALESCE(p_volume_m3, 0) / item_count;

  IF total_weight > 0 THEN
    -- ===== OG'IRLIK BO'YICHA TAQSIMLASH =====
    distribution_method := 'by_weight';

    FOR item_record IN 
      SELECT pi.id, pi.product_id, pi.unit_cost_usd, pi.domestic_shipping_cost, 
             pi.exchange_rate_at_purchase, pi.quantity,
             COALESCE(pi.weight_grams, pv.weight, 0) AS eff_weight
      FROM public.product_items pi
      LEFT JOIN public.product_variants pv ON pi.variant_id = pv.id
      WHERE pi.box_id = p_box_id
    LOOP
      -- This item's share of total shipping (USD)
      per_item_shipping := (item_record.eff_weight / total_weight) * COALESCE(p_shipping_cost, 0);
      
      -- Convert to UZS, divide by product quantity for per-unit cost
      shipping_per_unit_uzs := (per_item_shipping * p_usd_to_uzs) / GREATEST(COALESCE(item_record.quantity, 1), 1);

      -- Update product_items with USD shipping cost
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

      -- Update products.cost_price (so'mda) — add shipping per unit
      UPDATE public.products
      SET cost_price = COALESCE(cost_price, 0) + ROUND(shipping_per_unit_uzs::numeric, 0)
      WHERE id = item_record.product_id;

      updated_count := updated_count + 1;
    END LOOP;
  ELSE
    -- ===== TENG TAQSIMLASH (og'irlik yo'q) =====
    distribution_method := 'equal';
    per_item_shipping := COALESCE(p_shipping_cost, 0) / item_count;

    FOR item_record IN 
      SELECT pi.id, pi.product_id, pi.unit_cost_usd, pi.domestic_shipping_cost, 
             pi.exchange_rate_at_purchase, pi.quantity
      FROM public.product_items pi
      WHERE pi.box_id = p_box_id
    LOOP
      shipping_per_unit_uzs := (per_item_shipping * p_usd_to_uzs) / GREATEST(COALESCE(item_record.quantity, 1), 1);

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

      -- Update products.cost_price (so'mda)
      UPDATE public.products
      SET cost_price = COALESCE(cost_price, 0) + ROUND(shipping_per_unit_uzs::numeric, 0)
      WHERE id = item_record.product_id;

      updated_count := updated_count + 1;
    END LOOP;
  END IF;

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

COMMENT ON FUNCTION public.auto_distribute_box_shipping_cost(uuid, numeric, numeric, numeric) IS 
'PDF import qilganda shipping cost ni og''irlikka qarab taqsimlaydi va products.cost_price ga so''mda qo''shadi';
