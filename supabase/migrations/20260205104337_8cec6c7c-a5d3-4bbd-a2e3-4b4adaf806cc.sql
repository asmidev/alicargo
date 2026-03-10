-- Phase 12: Fix mutable search_path in database functions for security

-- Fix distribute_domestic_shipping
CREATE OR REPLACE FUNCTION public.distribute_domestic_shipping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  item_count INTEGER;
  per_item_cost NUMERIC;
  exchange_rate NUMERIC;
BEGIN
  IF NEW.domestic_shipping_total IS NOT NULL AND 
     NEW.domestic_shipping_total > 0 AND
     (OLD.domestic_shipping_total IS NULL OR OLD.domestic_shipping_total != NEW.domestic_shipping_total) THEN
    
    SELECT COUNT(*) INTO item_count 
    FROM public.product_items 
    WHERE product_id = NEW.id;
    
    IF item_count > 0 THEN
      per_item_cost := NEW.domestic_shipping_total / item_count;
      exchange_rate := COALESCE(NEW.purchase_exchange_rate, 7.25);
      
      UPDATE public.product_items 
      SET 
        domestic_shipping_cost = per_item_cost,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'purchase_price', unit_cost,
            'purchase_currency', unit_cost_currency,
            'domestic_shipping', per_item_cost,
            'domestic_shipping_currency', 'CNY'
          ),
        final_cost_usd = COALESCE(unit_cost_usd, 0) + (per_item_cost / exchange_rate) + COALESCE(international_shipping_cost, 0)
      WHERE product_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix distribute_international_shipping
CREATE OR REPLACE FUNCTION public.distribute_international_shipping(p_box_ids uuid[], p_total_shipping_cost numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_volume NUMERIC := 0;
  item_record RECORD;
BEGIN
  SELECT COALESCE(SUM(pi.volume_m3), 0) INTO total_volume
  FROM public.product_items pi
  WHERE pi.box_id = ANY(p_box_ids) AND pi.volume_m3 > 0;
  
  IF total_volume = 0 THEN
    SELECT COUNT(*) INTO total_volume
    FROM public.product_items pi
    WHERE pi.box_id = ANY(p_box_ids);
    
    IF total_volume > 0 THEN
      UPDATE public.product_items 
      SET 
        international_shipping_cost = p_total_shipping_cost / total_volume,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object('international_shipping', p_total_shipping_cost / total_volume, 'distribution_method', 'equal'),
        final_cost_usd = COALESCE(unit_cost_usd, 0) + 
          (COALESCE(domestic_shipping_cost, 0) / COALESCE(exchange_rate_at_purchase, 7.25)) + 
          (p_total_shipping_cost / total_volume)
      WHERE box_id = ANY(p_box_ids);
    END IF;
  ELSE
    FOR item_record IN 
      SELECT id, volume_m3, unit_cost_usd, domestic_shipping_cost, exchange_rate_at_purchase
      FROM public.product_items 
      WHERE box_id = ANY(p_box_ids)
    LOOP
      UPDATE public.product_items 
      SET 
        international_shipping_cost = (COALESCE(item_record.volume_m3, 0) / total_volume) * p_total_shipping_cost,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'international_shipping', (COALESCE(item_record.volume_m3, 0) / total_volume) * p_total_shipping_cost, 
            'distribution_method', 'by_volume',
            'volume_ratio', COALESCE(item_record.volume_m3, 0) / total_volume
          ),
        final_cost_usd = COALESCE(item_record.unit_cost_usd, 0) + 
          (COALESCE(item_record.domestic_shipping_cost, 0) / COALESCE(item_record.exchange_rate_at_purchase, 7.25)) + 
          ((COALESCE(item_record.volume_m3, 0) / total_volume) * p_total_shipping_cost)
      WHERE id = item_record.id;
    END LOOP;
  END IF;
END;
$function$;

-- Fix recalculate_final_cost_on_arrival
CREATE OR REPLACE FUNCTION public.recalculate_final_cost_on_arrival()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'arrived' AND (OLD.status IS NULL OR OLD.status != 'arrived') THEN
    UPDATE public.product_items pi
    SET final_cost_usd = 
      COALESCE(pi.unit_cost_usd, 0) + 
      (COALESCE(pi.domestic_shipping_cost, 0) / COALESCE(pi.exchange_rate_at_purchase, 7.25)) + 
      COALESCE(pi.international_shipping_cost, 0),
      cost_breakdown = COALESCE(pi.cost_breakdown, '{}'::jsonb) || 
        jsonb_build_object('calculated_at', now(), 'status', 'final')
    WHERE pi.box_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix auto_create_purchase_transaction (missing SET search_path)
CREATE OR REPLACE FUNCTION public.auto_create_purchase_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.price IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    INSERT INTO public.finance_transactions (
      transaction_type,
      amount,
      currency,
      category,
      description,
      reference_id,
      created_by
    ) VALUES (
      'expense',
      NEW.price * NEW.quantity,
      COALESCE(NEW.purchase_currency, 'USD'),
      'Mahsulot sotib olish',
      NEW.name || ' (' || NEW.quantity || ' dona)',
      NEW.id,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix mark_box_arrived_on_scan
CREATE OR REPLACE FUNCTION public.mark_box_arrived_on_scan(p_box_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_box RECORD;
  v_result JSONB;
BEGIN
  SELECT id, box_number, status, location INTO v_box
  FROM boxes
  WHERE id = p_box_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Box not found');
  END IF;
  
  IF v_box.status = 'in_transit' THEN
    UPDATE boxes
    SET 
      status = 'arrived',
      location = 'uzbekistan',
      actual_arrival = NOW()
    WHERE id = p_box_id;
    
    INSERT INTO tracking_events (entity_type, entity_id, event_type, description, location, created_by, metadata)
    VALUES (
      'box',
      p_box_id,
      'arrived',
      v_box.box_number || ': QR skanerlash orqali yetib keldi',
      'uzbekistan',
      p_user_id,
      jsonb_build_object('trigger', 'qr_scan', 'auto_arrival', true)
    );
    
    RETURN jsonb_build_object(
      'success', true, 
      'box_number', v_box.box_number,
      'auto_arrived', true,
      'message', 'Quti avtomatik "Yetib keldi" deb belgilandi'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true, 
      'box_number', v_box.box_number,
      'auto_arrived', false,
      'current_status', v_box.status,
      'message', 'Quti allaqachon ' || v_box.status || ' holatida'
    );
  END IF;
END;
$function$;

-- Fix trigger_tashkent_stock_sync (needs search_path)
CREATE OR REPLACE FUNCTION public.trigger_tashkent_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.tashkent_manual_stock IS DISTINCT FROM OLD.tashkent_manual_stock THEN
    INSERT INTO marketplace_sync_queue (
      product_id, 
      sync_type, 
      old_value, 
      new_value,
      status,
      created_at
    ) VALUES (
      NEW.id, 
      'stock_fbs', 
      OLD.tashkent_manual_stock, 
      NEW.tashkent_manual_stock,
      'pending',
      now()
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix confirm_arrived_products (needs search_path)
CREATE OR REPLACE FUNCTION public.confirm_arrived_products(p_item_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix decrement_tashkent_stock (needs search_path)
CREATE OR REPLACE FUNCTION public.decrement_tashkent_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE products 
  SET tashkent_manual_stock = GREATEST(0, COALESCE(tashkent_manual_stock, 0) - p_quantity)
  WHERE id = p_product_id;
END;
$function$;