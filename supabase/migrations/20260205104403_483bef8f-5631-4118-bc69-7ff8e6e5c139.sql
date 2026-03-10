-- Fix remaining 4 functions with mutable search_path

-- Fix suggest_products_from_listings
CREATE OR REPLACE FUNCTION public.suggest_products_from_listings()
RETURNS TABLE(suggested_name text, external_barcode text, external_sku text, listing_count bigint, store_names text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ml.title as suggested_name,
    ml.external_barcode,
    ml.external_sku,
    COUNT(*)::BIGINT as listing_count,
    STRING_AGG(DISTINCT ms.name, ', ') as store_names
  FROM marketplace_listings ml
  JOIN marketplace_stores ms ON ml.store_id = ms.id
  WHERE ml.product_id IS NULL
  GROUP BY ml.title, ml.external_barcode, ml.external_sku
  ORDER BY listing_count DESC
  LIMIT 100;
END;
$function$;

-- Fix generate_receipt_number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  today_prefix TEXT;
  seq_num INTEGER;
BEGIN
  today_prefix := 'DS-' || to_char(now(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(receipt_number, '^DS-\d{8}-', ''), '')::INTEGER
  ), 0) + 1
  INTO seq_num
  FROM direct_sales
  WHERE receipt_number LIKE today_prefix || '-%';
  
  RETURN today_prefix || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$function$;

-- Fix set_receipt_number
CREATE OR REPLACE FUNCTION public.set_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := generate_receipt_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix auto_distribute_box_shipping_cost (uuid,numeric,numeric version)
CREATE OR REPLACE FUNCTION public.auto_distribute_box_shipping_cost(p_box_id uuid, p_shipping_cost numeric, p_volume_m3 numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  item_count INTEGER;
  per_item_volume NUMERIC;
  per_item_shipping NUMERIC;
  updated_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO item_count 
  FROM public.product_items 
  WHERE box_id = p_box_id;
  
  IF item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Qutida mahsulot topilmadi', 'updated', 0);
  END IF;
  
  per_item_volume := COALESCE(p_volume_m3, 0) / item_count;
  per_item_shipping := COALESCE(p_shipping_cost, 0) / item_count;
  
  UPDATE public.product_items 
  SET 
    volume_m3 = per_item_volume,
    international_shipping_cost = per_item_shipping,
    cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
      jsonb_build_object(
        'international_shipping', per_item_shipping, 
        'distribution_method', 'auto_equal',
        'volume_per_item', per_item_volume,
        'total_box_volume', p_volume_m3,
        'total_shipping_cost', p_shipping_cost,
        'distributed_at', now()
      ),
    final_cost_usd = COALESCE(unit_cost_usd, 0) + 
      (COALESCE(domestic_shipping_cost, 0) / COALESCE(exchange_rate_at_purchase, 7.25)) + 
      per_item_shipping
  WHERE box_id = p_box_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Yo''l haqqi avtomatik taqsimlandi',
    'updated', updated_count,
    'per_item_volume', per_item_volume,
    'per_item_shipping', per_item_shipping
  );
END;
$function$;