-- Phase 1: Critical Security Fixes

-- Fix C1: Update mark_box_arrived_on_scan to use auth.uid() and verify roles
CREATE OR REPLACE FUNCTION public.mark_box_arrived_on_scan(p_box_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_box RECORD;
  v_result JSONB;
BEGIN
  -- Check authentication
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Verify user has appropriate role (uz_receiver, uz_manager, uz_quality, bosh_admin, rahbar)
  IF NOT has_role(v_user_id, 'uz_receiver') 
     AND NOT has_role(v_user_id, 'uz_manager') 
     AND NOT has_role(v_user_id, 'uz_quality')
     AND NOT has_role(v_user_id, 'bosh_admin') 
     AND NOT has_role(v_user_id, 'rahbar') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;
  
  SELECT id, box_number, status, location INTO v_box
  FROM boxes
  WHERE id = p_box_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Box not found');
  END IF;
  
  IF v_box.status = 'in_transit' THEN
    UPDATE boxes
    SET 
      status = 'arrived',
      location = 'uzbekistan',
      actual_arrival = NOW()
    WHERE id = p_box_id;
    
    INSERT INTO tracking_events (entity_type, entity_id, event_type, description, location, created_by, metadata)
    VALUES (
      'box',
      p_box_id,
      'arrived',
      v_box.box_number || ': QR skanerlash orqali yetib keldi',
      'uzbekistan',
      v_user_id,
      jsonb_build_object('trigger', 'qr_scan', 'auto_arrival', true)
    );
    
    RETURN jsonb_build_object(
      'success', true, 
      'box_number', v_box.box_number,
      'auto_arrived', true,
      'message', 'Quti avtomatik "Yetib keldi" deb belgilandi'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true, 
      'box_number', v_box.box_number,
      'auto_arrived', false,
      'current_status', v_box.status,
      'message', 'Quti allaqachon ' || v_box.status || ' holatida'
    );
  END IF;
END;
$function$;

-- Fix M1: Update remaining function with mutable search_path
CREATE OR REPLACE FUNCTION public.update_marketplace_finance_summary_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix C4: Restrict profiles table visibility
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  );

-- Fix C5: Restrict marketplace_stores visibility (using existing roles only)
DROP POLICY IF EXISTS "Authenticated users can view stores" ON marketplace_stores;
DROP POLICY IF EXISTS "marketplace_stores_select" ON marketplace_stores;

CREATE POLICY "Managers can view marketplace stores"
  ON marketplace_stores FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'moliya_xodimi')
  );

-- Fix H2: Populate variant barcodes from marketplace listings
UPDATE product_variants pv
SET barcode = ml.external_barcode
FROM marketplace_listings ml
WHERE pv.sku = ml.external_sku
AND ml.external_barcode IS NOT NULL
AND ml.external_barcode != ''
AND (pv.barcode IS NULL OR pv.barcode = '');