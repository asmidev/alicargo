-- Add a new status for products awaiting confirmation in Tashkent warehouse
-- Products will first be 'arrived_pending' then after confirmation become 'in_tashkent'

-- Update the trigger to set products to 'arrived_pending' instead of 'in_tashkent' when box arrives
CREATE OR REPLACE FUNCTION update_items_on_box_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When box status changes to 'in_transit', update all items
  IF NEW.status = 'in_transit' AND (OLD.status IS NULL OR OLD.status != 'in_transit') THEN
    UPDATE product_items
    SET 
      status = 'in_transit',
      location = 'transit',
      updated_at = now()
    WHERE box_id = NEW.id;
  END IF;
  
  -- When box status changes to 'arrived', update all items to 'arrived_pending' (awaiting confirmation)
  IF NEW.status = 'arrived' AND (OLD.status IS NULL OR OLD.status != 'arrived') THEN
    UPDATE product_items
    SET 
      status = 'arrived_pending',
      location = 'uzbekistan',
      updated_at = now()
    WHERE box_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to confirm product items in Tashkent warehouse
CREATE OR REPLACE FUNCTION confirm_arrived_products(p_item_ids uuid[])
RETURNS json AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE product_items
  SET 
    status = 'in_tashkent',
    updated_at = now()
  WHERE id = ANY(p_item_ids)
    AND status = 'arrived_pending';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also increment tashkent_manual_stock for each product
  UPDATE products p
  SET tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + counts.cnt
  FROM (
    SELECT product_id, COUNT(*) as cnt
    FROM product_items
    WHERE id = ANY(p_item_ids)
    GROUP BY product_id
  ) counts
  WHERE p.id = counts.product_id;
  
  RETURN json_build_object('confirmed_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;