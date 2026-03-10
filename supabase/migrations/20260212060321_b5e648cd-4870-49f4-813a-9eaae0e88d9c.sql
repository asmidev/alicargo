
-- Price auto-sync trigger: when marketplace_listings.price changes, update linked product's selling_price
CREATE OR REPLACE FUNCTION public.auto_sync_listing_price_to_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync if price actually changed and product is linked
  IF NEW.product_id IS NOT NULL 
     AND NEW.price IS NOT NULL 
     AND (OLD.price IS NULL OR OLD.price != NEW.price) THEN
    
    UPDATE products
    SET selling_price = NEW.price
    WHERE id = NEW.product_id
      AND price_source = 'marketplace_auto';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_sync_listing_price
AFTER UPDATE OF price ON marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION auto_sync_listing_price_to_product();
