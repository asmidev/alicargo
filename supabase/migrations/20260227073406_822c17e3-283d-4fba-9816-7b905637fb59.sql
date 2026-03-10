
CREATE OR REPLACE FUNCTION public.decrement_tashkent_stock(p_product_id uuid, p_quantity integer, p_variant_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants 
    SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - p_quantity)
    WHERE id = p_variant_id;
    
    -- Independently decrement product-level stock (no SUM recalculation)
    UPDATE products 
    SET tashkent_manual_stock = GREATEST(0, COALESCE(tashkent_manual_stock, 0) - p_quantity)
    WHERE id = p_product_id;
  ELSE
    UPDATE products 
    SET tashkent_manual_stock = GREATEST(0, COALESCE(tashkent_manual_stock, 0) - p_quantity)
    WHERE id = p_product_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_tashkent_stock(p_product_id uuid, p_quantity integer, p_variant_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants 
    SET stock_quantity = COALESCE(stock_quantity, 0) + p_quantity
    WHERE id = p_variant_id;
    
    -- Independently increment product-level stock (no SUM recalculation)
    UPDATE products 
    SET tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + p_quantity
    WHERE id = p_product_id;
  ELSE
    UPDATE products 
    SET tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + p_quantity
    WHERE id = p_product_id;
  END IF;
END;
$function$;
