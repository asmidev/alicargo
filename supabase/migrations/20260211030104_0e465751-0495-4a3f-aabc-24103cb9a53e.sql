
-- Step 1: Update auto_create_marketplace_income trigger to DELETE income when order is cancelled/returned
CREATE OR REPLACE FUNCTION public.auto_create_marketplace_income()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  store_name TEXT;
  store_platform TEXT;
  net_amount NUMERIC;
BEGIN
  -- Handle cancelled/returned: remove income transaction
  IF NEW.fulfillment_status IN ('cancelled', 'canceled', 'returned')
     AND OLD.fulfillment_status = 'delivered' THEN
    DELETE FROM public.finance_transactions
    WHERE reference_id = NEW.id AND reference_type = 'marketplace_order';
    RETURN NEW;
  END IF;

  -- Handle delivered: create income transaction
  IF NEW.fulfillment_status = 'delivered' AND 
     (TG_OP = 'INSERT' OR OLD.fulfillment_status IS NULL OR OLD.fulfillment_status != 'delivered') THEN
    
    SELECT name, platform INTO store_name, store_platform
    FROM public.marketplace_stores
    WHERE id = NEW.store_id;
    
    net_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.commission, 0);
    
    IF NOT EXISTS (
      SELECT 1 FROM public.finance_transactions 
      WHERE reference_id = NEW.id AND reference_type = 'marketplace_order'
    ) THEN
      INSERT INTO public.finance_transactions (
        transaction_type, amount, currency, category, description,
        reference_id, reference_type, marketplace_commission, marketplace_store_id
      ) VALUES (
        'income', net_amount, COALESCE(NEW.currency, 'UZS'),
        'Marketplace sotuv - ' || COALESCE(store_platform, 'unknown'),
        'Order #' || COALESCE(NEW.external_order_id, NEW.id::text) || ' (' || COALESCE(store_name, 'Store') || ')',
        NEW.id, 'marketplace_order', COALESCE(NEW.commission, 0), NEW.store_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
