-- Add weight_grams column to product_items
ALTER TABLE public.product_items 
ADD COLUMN IF NOT EXISTS weight_grams NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.product_items.weight_grams IS 'Mahsulot og''irligi gramda (logistika taqsimlash uchun)';

-- Create or replace the distribute_shipping_by_weight function
CREATE OR REPLACE FUNCTION public.distribute_shipping_by_weight(
  p_box_ids UUID[],
  p_total_shipping_cost NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_weight NUMERIC := 0;
  item_count INTEGER := 0;
  item_record RECORD;
BEGIN
  -- Calculate total weight
  SELECT COALESCE(SUM(weight_grams), 0) INTO total_weight
  FROM public.product_items
  WHERE box_id = ANY(p_box_ids) AND weight_grams > 0;
  
  -- If no weight data, distribute equally
  IF total_weight = 0 THEN
    SELECT COUNT(*) INTO item_count
    FROM public.product_items
    WHERE box_id = ANY(p_box_ids);
    
    IF item_count > 0 THEN
      UPDATE public.product_items 
      SET 
        international_shipping_cost = p_total_shipping_cost / item_count,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'international_shipping', p_total_shipping_cost / item_count, 
            'distribution_method', 'equal'
          ),
        final_cost_usd = COALESCE(unit_cost_usd, 0) + 
          (COALESCE(domestic_shipping_cost, 0) / COALESCE(NULLIF(exchange_rate_at_purchase, 0), 7.25)) + 
          (p_total_shipping_cost / item_count)
      WHERE box_id = ANY(p_box_ids);
    END IF;
  ELSE
    -- Distribute by weight
    FOR item_record IN 
      SELECT pi.id, pi.weight_grams, pi.unit_cost_usd, pi.domestic_shipping_cost, 
             pi.exchange_rate_at_purchase, pi.variant_id
      FROM public.product_items pi
      WHERE pi.box_id = ANY(p_box_ids)
    LOOP
      UPDATE public.product_items 
      SET 
        international_shipping_cost = (COALESCE(item_record.weight_grams, 0) / total_weight) * p_total_shipping_cost,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'international_shipping', (COALESCE(item_record.weight_grams, 0) / total_weight) * p_total_shipping_cost, 
            'distribution_method', 'by_weight',
            'weight_grams', item_record.weight_grams,
            'weight_ratio', COALESCE(item_record.weight_grams, 0) / total_weight
          ),
        final_cost_usd = COALESCE(item_record.unit_cost_usd, 0) + 
          (COALESCE(item_record.domestic_shipping_cost, 0) / COALESCE(NULLIF(item_record.exchange_rate_at_purchase, 0), 7.25)) + 
          ((COALESCE(item_record.weight_grams, 0) / total_weight) * p_total_shipping_cost)
      WHERE id = item_record.id;
      
      -- Save weight to variant for future use (only if variant exists and weight is set)
      IF item_record.variant_id IS NOT NULL AND item_record.weight_grams IS NOT NULL AND item_record.weight_grams > 0 THEN
        UPDATE public.product_variants 
        SET weight = item_record.weight_grams
        WHERE id = item_record.variant_id AND (weight IS NULL OR weight = 0);
      END IF;
    END LOOP;
  END IF;
END;
$$;