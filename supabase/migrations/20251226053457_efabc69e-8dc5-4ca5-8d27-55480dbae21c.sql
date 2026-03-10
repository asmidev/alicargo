-- =============================================
-- 5-BOSQICH: DEFECT CLAIMS & INVENTORY MANAGEMENT
-- =============================================

-- 1. DEFECT CLAIMS (Nuqsonli mahsulot da'volari)
-- =============================================

-- Da'volar jadvali
CREATE TABLE public.defect_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT NOT NULL UNIQUE,
  box_id UUID REFERENCES public.boxes(id) ON DELETE SET NULL,
  verification_session_id UUID REFERENCES public.verification_sessions(id) ON DELETE SET NULL,
  product_item_id UUID REFERENCES public.product_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  defect_category_id UUID REFERENCES public.defect_categories(id) ON DELETE SET NULL,
  defect_description TEXT,
  photo_urls JSONB DEFAULT '[]'::jsonb,
  claim_amount NUMERIC,
  claim_currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'compensated')),
  submitted_to_abusaxiy BOOLEAN DEFAULT false,
  abusaxiy_reference TEXT,
  resolution_notes TEXT,
  compensation_amount NUMERIC,
  compensation_currency TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Da'vo holati tarixi
CREATE TABLE public.claim_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.defect_claims(id) ON DELETE CASCADE NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for claims tables
ALTER TABLE public.defect_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for defect_claims
CREATE POLICY "Claims viewable by authenticated" ON public.defect_claims
  FOR SELECT USING (true);

CREATE POLICY "Authorized users can create claims" ON public.defect_claims
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'uz_manager') OR
    has_role(auth.uid(), 'uz_quality') OR
    has_role(auth.uid(), 'uz_receiver')
  );

CREATE POLICY "Authorized users can update claims" ON public.defect_claims
  FOR UPDATE USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'uz_manager')
  );

CREATE POLICY "Admins can delete claims" ON public.defect_claims
  FOR DELETE USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  );

-- RLS Policies for claim_status_history
CREATE POLICY "Claim history viewable by authenticated" ON public.claim_status_history
  FOR SELECT USING (true);

CREATE POLICY "System can insert claim history" ON public.claim_status_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger to auto-insert status history
CREATE OR REPLACE FUNCTION public.track_claim_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.claim_status_history (claim_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER track_claim_status
  BEFORE UPDATE ON public.defect_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.track_claim_status_change();

-- Function to generate claim number
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(claim_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.defect_claims
  WHERE claim_number LIKE 'CLM-' || year_prefix || '-%';
  
  NEW.claim_number := 'CLM-' || year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER generate_claim_number_trigger
  BEFORE INSERT ON public.defect_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_claim_number();

-- 2. INVENTORY MANAGEMENT (Ombor boshqaruvi)
-- =============================================

-- Omborlar jadvali
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL CHECK (location IN ('china', 'uzbekistan')),
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ombor joylashuvlari (zonalar, javonlar)
CREATE TABLE public.warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
  zone TEXT NOT NULL,
  shelf TEXT,
  position TEXT,
  capacity INTEGER DEFAULT 100,
  current_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stock alertlar
CREATE TABLE public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock', 'reorder')),
  threshold INTEGER NOT NULL,
  current_stock INTEGER NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mahsulot harakatlari (inventory movements)
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_item_id UUID REFERENCES public.product_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('transfer', 'sale', 'return', 'adjustment', 'receive', 'ship')),
  quantity INTEGER DEFAULT 1,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add warehouse_location_id to product_items
ALTER TABLE public.product_items 
ADD COLUMN IF NOT EXISTS warehouse_location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;

-- Enable RLS for inventory tables
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouses
CREATE POLICY "Warehouses viewable by authenticated" ON public.warehouses
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage warehouses" ON public.warehouses
  FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'uz_manager')
  );

-- RLS Policies for warehouse_locations
CREATE POLICY "Locations viewable by authenticated" ON public.warehouse_locations
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage locations" ON public.warehouse_locations
  FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'uz_manager')
  );

-- RLS Policies for stock_alerts
CREATE POLICY "Alerts viewable by authenticated" ON public.stock_alerts
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage alerts" ON public.stock_alerts
  FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'uz_manager')
  );

-- RLS Policies for inventory_movements
CREATE POLICY "Movements viewable by authenticated" ON public.inventory_movements
  FOR SELECT USING (true);

CREATE POLICY "Staff can create movements" ON public.inventory_movements
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default warehouses
INSERT INTO public.warehouses (name, location, address) VALUES
  ('Xitoy Ombori', 'china', 'Guangzhou, China'),
  ('Toshkent Ombori', 'uzbekistan', 'Toshkent, O''zbekiston');

-- Function to check and create stock alerts
CREATE OR REPLACE FUNCTION public.check_stock_levels()
RETURNS TRIGGER AS $$
DECLARE
  product_stock INTEGER;
  low_threshold INTEGER := 10;
BEGIN
  -- Count total stock for product
  SELECT COUNT(*) INTO product_stock
  FROM public.product_items
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND status IN ('pending', 'in_box', 'in_transit', 'arrived');
  
  -- Check for low stock
  IF product_stock <= low_threshold THEN
    INSERT INTO public.stock_alerts (product_id, alert_type, threshold, current_stock)
    VALUES (COALESCE(NEW.product_id, OLD.product_id), 
            CASE WHEN product_stock = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
            low_threshold, 
            product_stock)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;