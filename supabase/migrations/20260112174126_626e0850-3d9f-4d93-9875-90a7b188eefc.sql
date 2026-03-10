-- Trigger to auto-update current_count when warehouse_location_id changes on product_items
CREATE OR REPLACE FUNCTION public.update_section_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle UPDATE case
  IF TG_OP = 'UPDATE' THEN
    -- Decrement old section count if moving from a section
    IF OLD.warehouse_location_id IS NOT NULL AND (NEW.warehouse_location_id IS NULL OR OLD.warehouse_location_id != NEW.warehouse_location_id) THEN
      UPDATE public.warehouse_locations 
      SET current_count = GREATEST(0, COALESCE(current_count, 0) - 1)
      WHERE id = OLD.warehouse_location_id;
    END IF;
    
    -- Increment new section count if moving to a section
    IF NEW.warehouse_location_id IS NOT NULL AND (OLD.warehouse_location_id IS NULL OR OLD.warehouse_location_id != NEW.warehouse_location_id) THEN
      UPDATE public.warehouse_locations 
      SET current_count = COALESCE(current_count, 0) + 1
      WHERE id = NEW.warehouse_location_id;
    END IF;
  END IF;
  
  -- Handle INSERT case
  IF TG_OP = 'INSERT' AND NEW.warehouse_location_id IS NOT NULL THEN
    UPDATE public.warehouse_locations 
    SET current_count = COALESCE(current_count, 0) + 1
    WHERE id = NEW.warehouse_location_id;
  END IF;
  
  -- Handle DELETE case
  IF TG_OP = 'DELETE' AND OLD.warehouse_location_id IS NOT NULL THEN
    UPDATE public.warehouse_locations 
    SET current_count = GREATEST(0, COALESCE(current_count, 0) - 1)
    WHERE id = OLD.warehouse_location_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for UPDATE
DROP TRIGGER IF EXISTS product_item_location_update ON public.product_items;
CREATE TRIGGER product_item_location_update
  AFTER UPDATE OF warehouse_location_id ON public.product_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_section_count();

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS product_item_location_insert ON public.product_items;
CREATE TRIGGER product_item_location_insert
  AFTER INSERT ON public.product_items
  FOR EACH ROW
  WHEN (NEW.warehouse_location_id IS NOT NULL)
  EXECUTE FUNCTION public.update_section_count();

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS product_item_location_delete ON public.product_items;
CREATE TRIGGER product_item_location_delete
  AFTER DELETE ON public.product_items
  FOR EACH ROW
  WHEN (OLD.warehouse_location_id IS NOT NULL)
  EXECUTE FUNCTION public.update_section_count();