
-- QADAM 5: Backfill commission for existing Uzum delivered orders

-- Step 1: Match by barcode (highest match rate ~97%)
UPDATE marketplace_orders mo
SET commission = ROUND(
  mo.total_amount * ml.commission_rate / 100
)
FROM marketplace_listings ml
WHERE ml.store_id = mo.store_id
  AND ml.external_barcode IS NOT NULL
  AND ml.external_barcode != ''
  AND ml.external_barcode = (mo.items->0->>'barcode')
  AND ml.commission_rate IS NOT NULL
  AND ml.commission_rate > 0
  AND (mo.commission IS NULL OR mo.commission = 0)
  AND mo.fulfillment_status = 'delivered'
  AND mo.store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- Step 2: Match remaining by productId
UPDATE marketplace_orders mo
SET commission = ROUND(
  mo.total_amount * ml.commission_rate / 100
)
FROM marketplace_listings ml
WHERE ml.store_id = mo.store_id
  AND ml.external_product_id IS NOT NULL
  AND ml.external_product_id != ''
  AND ml.external_product_id = (mo.items->0->>'productId')
  AND ml.commission_rate IS NOT NULL
  AND ml.commission_rate > 0
  AND (mo.commission IS NULL OR mo.commission = 0)
  AND mo.fulfillment_status = 'delivered'
  AND mo.store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- Step 3: Fallback - use store average commission rate for remaining orders
WITH store_avg AS (
  SELECT store_id, AVG(commission_rate) as avg_rate
  FROM marketplace_listings
  WHERE commission_rate IS NOT NULL AND commission_rate > 0
  GROUP BY store_id
)
UPDATE marketplace_orders mo
SET commission = ROUND(mo.total_amount * sa.avg_rate / 100)
FROM store_avg sa
WHERE sa.store_id = mo.store_id
  AND (mo.commission IS NULL OR mo.commission = 0)
  AND mo.fulfillment_status = 'delivered'
  AND mo.store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- QADAM 6: Update auto_create_marketplace_income trigger to use net revenue
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
  IF NEW.fulfillment_status = 'delivered' AND 
     (TG_OP = 'INSERT' OR OLD.fulfillment_status IS NULL OR OLD.fulfillment_status != 'delivered') THEN
    
    SELECT name, platform INTO store_name, store_platform
    FROM public.marketplace_stores
    WHERE id = NEW.store_id;
    
    -- Calculate net amount (gross - commission)
    net_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.commission, 0);
    
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
        reference_type,
        marketplace_commission,
        marketplace_store_id
      ) VALUES (
        'income',
        net_amount,
        COALESCE(NEW.currency, 'UZS'),
        'Marketplace sotuv - ' || COALESCE(store_platform, 'unknown'),
        'Order #' || COALESCE(NEW.external_order_id, NEW.id::text) || ' (' || COALESCE(store_name, 'Store') || ')',
        NEW.id,
        'marketplace_order',
        COALESCE(NEW.commission, 0),
        NEW.store_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
