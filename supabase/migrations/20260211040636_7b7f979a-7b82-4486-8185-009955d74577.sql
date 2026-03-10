
-- Drop existing function and recreate with variant support
DROP FUNCTION IF EXISTS public.decrement_tashkent_stock(uuid, integer);

CREATE OR REPLACE FUNCTION public.decrement_tashkent_stock(
  p_product_id UUID, 
  p_quantity INTEGER, 
  p_variant_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If variant_id is provided, decrement variant stock first
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants 
    SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - p_quantity)
    WHERE id = p_variant_id;
    
    -- Recalculate product-level stock from all variants
    UPDATE products 
    SET tashkent_manual_stock = COALESCE(
      (SELECT SUM(COALESCE(stock_quantity, 0)) 
       FROM product_variants 
       WHERE product_id = p_product_id),
      GREATEST(0, COALESCE(tashkent_manual_stock, 0) - p_quantity)
    )
    WHERE id = p_product_id;
  ELSE
    -- No variant: just decrement product-level stock
    UPDATE products 
    SET tashkent_manual_stock = GREATEST(0, COALESCE(tashkent_manual_stock, 0) - p_quantity)
    WHERE id = p_product_id;
  END IF;
END;
$$;
