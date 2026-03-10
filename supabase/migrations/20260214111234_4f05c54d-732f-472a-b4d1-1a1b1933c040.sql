
CREATE OR REPLACE FUNCTION public.calculate_transaction_usd()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uzs_rate NUMERIC;
  cny_rate NUMERIC;
BEGIN
  -- Get current exchange rates from history
  SELECT 
    (rates->>'UZS')::NUMERIC,
    (rates->>'CNY')::NUMERIC
  INTO uzs_rate, cny_rate
  FROM public.exchange_rates_history
  ORDER BY fetched_at DESC
  LIMIT 1;
  
  -- Default rates if not found
  IF uzs_rate IS NULL THEN
    uzs_rate := 12235;
  END IF;
  IF cny_rate IS NULL THEN
    cny_rate := 6.91;
  END IF;
  
  -- Store the exchange rate used
  NEW.exchange_rate_used := uzs_rate;
  
  -- Calculate USD amount based on currency
  IF NEW.currency = 'USD' THEN
    NEW.amount_usd := NEW.amount;
  ELSIF NEW.currency = 'UZS' THEN
    NEW.amount_usd := NEW.amount / uzs_rate;
  ELSIF NEW.currency = 'CNY' THEN
    NEW.amount_usd := NEW.amount / cny_rate;
  ELSE
    NEW.amount_usd := NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$function$;
