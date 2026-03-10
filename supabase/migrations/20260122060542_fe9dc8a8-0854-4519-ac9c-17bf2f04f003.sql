-- Create trigger function to update items when box status changes
CREATE OR REPLACE FUNCTION public.update_items_on_box_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When box goes to in_transit, update items to in_transit
  IF NEW.status = 'in_transit' AND OLD.status = 'sealed' THEN
    UPDATE product_items
    SET status = 'in_transit', location = 'transit', updated_at = NOW()
    WHERE box_id = NEW.id AND status IN ('packed', 'in_box');
  END IF;
  
  -- When box arrives, update items to in_tashkent and increment stock
  IF NEW.status = 'arrived' AND OLD.status = 'in_transit' THEN
    -- First update items to in_tashkent
    UPDATE product_items
    SET status = 'in_tashkent', location = 'uzbekistan', updated_at = NOW()
    WHERE box_id = NEW.id AND status = 'in_transit';
    
    -- Then increment tashkent_manual_stock for each product
    UPDATE products p
    SET tashkent_manual_stock = COALESCE(tashkent_manual_stock, 0) + item_counts.cnt
    FROM (
      SELECT product_id, COUNT(*) as cnt
      FROM product_items
      WHERE box_id = NEW.id AND status = 'in_tashkent'
      GROUP BY product_id
    ) item_counts
    WHERE p.id = item_counts.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on boxes table
DROP TRIGGER IF EXISTS trg_update_items_on_box_status ON boxes;
CREATE TRIGGER trg_update_items_on_box_status
  AFTER UPDATE ON boxes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_items_on_box_status_change();

-- Update mark_box_arrived_on_scan to use in_tashkent status
CREATE OR REPLACE FUNCTION public.mark_box_arrived_on_scan(p_box_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_box RECORD;
  v_result JSONB;
BEGIN
  -- Get current box status
  SELECT id, box_number, status, location INTO v_box
  FROM boxes
  WHERE id = p_box_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Box not found');
  END IF;
  
  -- Only auto-arrive if box is in_transit
  IF v_box.status = 'in_transit' THEN
    -- Update box status (trigger will handle product_items)
    UPDATE boxes
    SET 
      status = 'arrived',
      location = 'uzbekistan',
      actual_arrival = NOW()
    WHERE id = p_box_id;
    
    -- Create tracking event
    INSERT INTO tracking_events (entity_type, entity_id, event_type, description, location, created_by, metadata)
    VALUES (
      'box',
      p_box_id,
      'arrived',
      v_box.box_number || ': QR skanerlash orqali yetib keldi',
      'uzbekistan',
      p_user_id,
      jsonb_build_object('trigger', 'qr_scan', 'auto_arrival', true)
    );
    
    RETURN jsonb_build_object(
      'success', true, 
      'box_number', v_box.box_number,
      'auto_arrived', true,
      'message', 'Quti avtomatik "Yetib keldi" deb belgilandi'
    );
  ELSE
    -- Box not in transit, return current status
    RETURN jsonb_build_object(
      'success', true, 
      'box_number', v_box.box_number,
      'auto_arrived', false,
      'current_status', v_box.status,
      'message', 'Quti allaqachon ' || v_box.status || ' holatida'
    );
  END IF;
END;
$$;

-- Migrate existing data: fix arrived items to in_tashkent
UPDATE product_items 
SET status = 'in_tashkent' 
WHERE status = 'arrived' AND location = 'uzbekistan';

-- Migrate existing data: fix packed items in in_transit boxes
UPDATE product_items pi
SET status = 'in_transit', location = 'transit'
FROM boxes b
WHERE pi.box_id = b.id 
  AND b.status = 'in_transit' 
  AND pi.status IN ('packed', 'in_box');