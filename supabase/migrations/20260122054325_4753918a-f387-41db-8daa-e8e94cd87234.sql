-- Fix the auto_create_direct_sale_income trigger function
-- The error was: record "new" has no field "created_by"
-- The correct column in direct_sales table is "sold_by", not "created_by"

CREATE OR REPLACE FUNCTION public.auto_create_direct_sale_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create finance transaction if price_usd is set
  IF NEW.price_usd IS NOT NULL AND NEW.price_usd > 0 THEN
    INSERT INTO public.finance_transactions (
      transaction_type,
      amount,
      currency,
      category,
      description,
      reference_id,
      reference_type,
      created_by
    ) VALUES (
      'income',
      NEW.price_usd,
      'USD',
      'To''g''ridan-to''g''ri sotuv',
      COALESCE(NEW.product_name, 'Mahsulot') || ' - ' || COALESCE(NEW.receipt_number, NEW.id::text),
      NEW.id,
      'direct_sale',
      NEW.sold_by  -- Fixed: was "created_by" which doesn't exist, correct column is "sold_by"
    );
  END IF;
  RETURN NEW;
END;
$function$;