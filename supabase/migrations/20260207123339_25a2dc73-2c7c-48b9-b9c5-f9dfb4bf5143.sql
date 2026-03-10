
-- Fix: reference_id is UUID type, not text. Update function to use UUID directly
CREATE OR REPLACE FUNCTION public.auto_create_marketplace_income()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  store_name TEXT;
  store_platform TEXT;
BEGIN
  IF NEW.fulfillment_status = 'delivered' AND 
     (TG_OP = 'INSERT' OR OLD.fulfillment_status IS NULL OR OLD.fulfillment_status != 'delivered') THEN
    
    SELECT name, platform INTO store_name, store_platform
    FROM public.marketplace_stores
    WHERE id = NEW.store_id;
    
    IF NOT EXISTS (
      SELECT 1 FROM public.finance_transactions 
      WHERE reference_id = NEW.id AND reference_type = 'marketplace_order'
    ) THEN
      INSERT INTO public.finance_transactions (
        transaction_type,
        amount,
        currency,
        category,
        description,
        reference_id,
        reference_type
      ) VALUES (
        'income',
        COALESCE(NEW.total_amount, 0),
        COALESCE(NEW.currency, 'UZS'),
        'Marketplace sotuv - ' || COALESCE(store_platform, 'unknown'),
        'Order #' || COALESCE(NEW.external_order_id, NEW.id::text) || ' (' || COALESCE(store_name, 'Store') || ')',
        NEW.id,
        'marketplace_order'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
