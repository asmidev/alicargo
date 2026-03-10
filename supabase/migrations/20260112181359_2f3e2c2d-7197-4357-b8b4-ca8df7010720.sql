-- Create function to auto-seal box when verification is 100% complete
CREATE OR REPLACE FUNCTION public.auto_seal_box_on_verification_complete()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  verified_items INTEGER;
  qr_data_json JSONB;
BEGIN
  -- Only trigger if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Count total items in the box
    SELECT COUNT(*) INTO total_items
    FROM product_items
    WHERE box_id = NEW.box_id;
    
    -- Count verified items (from verification_items)
    SELECT COUNT(*) INTO verified_items
    FROM verification_items
    WHERE session_id = NEW.id AND status IN ('ok', 'defective', 'missing');
    
    -- If all items are verified
    IF total_items > 0 AND verified_items >= total_items THEN
      -- Build QR data
      qr_data_json := jsonb_build_object(
        'id', NEW.box_id,
        'cnt', total_items,
        't', to_char(NOW(), 'YYYY-MM-DD')
      );
      
      -- Update box: set verification_complete, auto-seal if still packing
      UPDATE boxes
      SET 
        verification_complete = true,
        china_verified_at = NOW(),
        china_verified_by = NEW.verified_by,
        defect_count = NEW.defective_count,
        missing_count = NEW.missing_count,
        verification_session_id = NEW.id,
        -- Auto-seal only if box is still in packing status
        status = CASE WHEN status = 'packing' THEN 'sealed' ELSE status END,
        qr_code = CASE WHEN status = 'packing' THEN NEW.box_id::text ELSE qr_code END,
        qr_data = CASE WHEN status = 'packing' THEN qr_data_json ELSE qr_data END,
        sealed_at = CASE WHEN status = 'packing' THEN NOW() ELSE sealed_at END,
        sealed_by = CASE WHEN status = 'packing' THEN NEW.verified_by ELSE sealed_by END
      WHERE id = NEW.box_id;
      
      -- If box was auto-sealed, create tracking event
      IF EXISTS (SELECT 1 FROM boxes WHERE id = NEW.box_id AND status = 'sealed') THEN
        INSERT INTO tracking_events (entity_type, entity_id, event_type, description, location, created_by, metadata)
        SELECT 
          'box',
          NEW.box_id,
          'auto_sealed',
          b.box_number || ': Avtomatik yopildi (100% tekshirilgan)',
          'china',
          NEW.verified_by,
          jsonb_build_object('ok_count', NEW.ok_count, 'defective_count', NEW.defective_count, 'missing_count', NEW.missing_count, 'trigger', 'auto_seal')
        FROM boxes b WHERE b.id = NEW.box_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on verification_sessions
DROP TRIGGER IF EXISTS trigger_auto_seal_box ON verification_sessions;
CREATE TRIGGER trigger_auto_seal_box
  AFTER UPDATE OF status ON verification_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_seal_box_on_verification_complete();

-- Also create a function to auto-update box status to 'arrived' when scanned in Uzbekistan
CREATE OR REPLACE FUNCTION public.mark_box_arrived_on_scan(
  p_box_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
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
    -- Update box status
    UPDATE boxes
    SET 
      status = 'arrived',
      location = 'uzbekistan',
      actual_arrival = NOW()
    WHERE id = p_box_id;
    
    -- Update all product items to arrived status in Uzbekistan
    UPDATE product_items
    SET 
      location = 'uzbekistan',
      status = 'arrived',
      updated_at = NOW()
    WHERE box_id = p_box_id AND status = 'in_transit';
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;