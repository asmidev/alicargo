
CREATE OR REPLACE FUNCTION public.increment_tashkent_stock(
  p_product_id uuid, p_quantity integer, p_variant_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants 
    SET stock_quantity = COALESCE(stock_quantity, 0) + p_quantity
    WHERE id = p_variant_id;
    
    UPDATE products 
    SET tashkent_manual_stock = COALESCE(
      (SELECT SUM(COALESCE(stock_quantity, 0)) FROM product_variants WHERE product_id = p_product_id),
      COALESCE(tashkent_manual_stock, 0) + p_quantity
    )
    WHERE id = p_product_id;
  ELSE
    UPDATE products 
    SET tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + p_quantity
    WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
