-- Create function to auto-update shipment status based on box statuses
CREATE OR REPLACE FUNCTION public.update_shipment_status_from_boxes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shipment_id uuid;
  v_total_boxes integer;
  v_arrived_boxes integer;
  v_in_transit_boxes integer;
BEGIN
  -- Get shipment ID for this box
  SELECT sb.shipment_id INTO v_shipment_id
  FROM shipment_boxes sb
  WHERE sb.box_id = NEW.id
  LIMIT 1;
  
  -- If box is not linked to any shipment, exit
  IF v_shipment_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count boxes in this shipment by status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE b.status IN ('arrived', 'delivered')),
    COUNT(*) FILTER (WHERE b.status = 'in_transit')
  INTO v_total_boxes, v_arrived_boxes, v_in_transit_boxes
  FROM shipment_boxes sb
  JOIN boxes b ON b.id = sb.box_id
  WHERE sb.shipment_id = v_shipment_id;
  
  -- Update shipment status based on box statuses
  IF v_arrived_boxes = v_total_boxes AND v_total_boxes > 0 THEN
    -- All boxes arrived
    UPDATE shipments 
    SET status = 'arrived', 
        arrival_date = COALESCE(arrival_date, now())
    WHERE id = v_shipment_id AND status != 'delivered';
  ELSIF v_in_transit_boxes > 0 OR v_arrived_boxes > 0 THEN
    -- Some boxes in transit or arrived
    UPDATE shipments 
    SET status = 'in_transit'
    WHERE id = v_shipment_id AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on boxes table
DROP TRIGGER IF EXISTS trigger_update_shipment_status ON boxes;
CREATE TRIGGER trigger_update_shipment_status
  AFTER UPDATE OF status ON boxes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_shipment_status_from_boxes();

-- Create function to sync box location with status
CREATE OR REPLACE FUNCTION public.sync_box_location_with_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-sync location based on status
  IF NEW.status = 'packing' OR NEW.status = 'sealed' THEN
    NEW.location := 'china';
  ELSIF NEW.status = 'in_transit' THEN
    NEW.location := 'transit';
  ELSIF NEW.status = 'arrived' OR NEW.status = 'delivered' THEN
    NEW.location := 'uzbekistan';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to sync location
DROP TRIGGER IF EXISTS trigger_sync_box_location ON boxes;
CREATE TRIGGER trigger_sync_box_location
  BEFORE UPDATE OF status ON boxes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_box_location_with_status();