
-- Update distribute_domestic_shipping trigger to also create finance_transactions
CREATE OR REPLACE FUNCTION public.distribute_domestic_shipping()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

    -- Create/update finance transaction for domestic shipping
    DELETE FROM public.finance_transactions 
    WHERE reference_id = NEW.id::text AND reference_type = 'domestic_shipping';

    INSERT INTO public.finance_transactions (
      transaction_type, amount, currency, category, description,
      reference_id, reference_type
    ) VALUES (
      'expense', NEW.domestic_shipping_total, 'CNY',
      'Xitoy ichki yetkazib berish',
      NEW.name || ' — Xitoy ichki yo''l haqi',
      NEW.id, 'domestic_shipping'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;
