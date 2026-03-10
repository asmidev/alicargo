
-- Step 1: Update the function to handle both INSERT and UPDATE
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
  -- Handle UPDATE: only when fulfillment_status changes to 'delivered'
  -- Handle INSERT: when inserted directly as 'delivered'
  IF NEW.fulfillment_status = 'delivered' AND 
     (TG_OP = 'INSERT' OR OLD.fulfillment_status IS NULL OR OLD.fulfillment_status != 'delivered') THEN
    
    -- Get store info
    SELECT name, platform INTO store_name, store_platform
    FROM public.marketplace_stores
    WHERE id = NEW.store_id;
    
    -- Check if transaction already exists (prevents duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM public.finance_transactions 
      WHERE reference_id = NEW.id::text AND reference_type = 'marketplace_order'
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
        NEW.id::text,
        'marketplace_order'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Step 2: Create the trigger on marketplace_orders for both INSERT and UPDATE
CREATE TRIGGER marketplace_income_trigger
AFTER INSERT OR UPDATE OF fulfillment_status ON public.marketplace_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_marketplace_income();
