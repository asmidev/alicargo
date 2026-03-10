-- Phase 2: Complete AliCargo CRM Database Schema
-- Creating all tables, enums, RLS policies, and functions

-- ============================================
-- 1. USER ROLES ENUM AND TABLE
-- ============================================

-- Create user roles enum
CREATE TYPE public.app_role AS ENUM (
  'rahbar',              -- Full access (CEO/Owner)
  'bosh_admin',          -- Super Admin
  'xitoy_manager',       -- China Branch Manager
  'xitoy_packer',        -- China Packer
  'xitoy_receiver',      -- China Receiver/Quality Control
  'uz_manager',          -- Uzbekistan Manager
  'uz_receiver',         -- Uzbekistan Receiver
  'uz_quality',          -- Uzbekistan Quality Control
  'manager',             -- General Manager
  'kuryer',              -- Courier/Delivery
  'moliya_xodimi',       -- Finance Staff
  'investor'             -- Investor (read-only finance)
);

-- Create user_roles table (CRITICAL: separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role)
);

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role)
);

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role)
);

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role)
);

-- ============================================
-- 2. PROFILES TABLE
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  language TEXT DEFAULT 'uz',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS for profiles
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- ============================================
-- 3. PRODUCTS TABLE
-- ============================================

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  weight DECIMAL,
  price DECIMAL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS for products
CREATE POLICY "Products viewable by all authenticated"
ON public.products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "China and managers can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_manager'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Authorized users can update products"
ON public.products FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_manager'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- ============================================
-- 4. BOXES TABLE
-- ============================================

CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_number TEXT NOT NULL UNIQUE,
  qr_code TEXT UNIQUE,
  qr_data JSONB,
  status TEXT DEFAULT 'packing',
  sealed_at TIMESTAMP WITH TIME ZONE,
  sealed_by UUID REFERENCES auth.users(id),
  location TEXT DEFAULT 'china',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;

-- RLS for boxes
CREATE POLICY "Boxes viewable by all authenticated"
ON public.boxes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "China staff can create boxes"
ON public.boxes FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_packer'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_manager'::app_role)
);

CREATE POLICY "Authorized users can update boxes"
ON public.boxes FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_packer'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_manager'::app_role) OR
  public.has_role(auth.uid(), 'uz_receiver'::app_role) OR
  public.has_role(auth.uid(), 'uz_manager'::app_role)
);

-- ============================================
-- 5. BOX_ITEMS TABLE (Products in Boxes)
-- ============================================

CREATE TABLE public.box_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  verified_china BOOLEAN DEFAULT false,
  verified_uz BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'ok',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(box_id, product_id)
);

ALTER TABLE public.box_items ENABLE ROW LEVEL SECURITY;

-- RLS for box_items
CREATE POLICY "Box items viewable by authenticated"
ON public.box_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "China staff can manage box items"
ON public.box_items FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_packer'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_manager'::app_role) OR
  public.has_role(auth.uid(), 'uz_receiver'::app_role) OR
  public.has_role(auth.uid(), 'uz_quality'::app_role)
);

-- ============================================
-- 6. SHIPMENTS TABLE
-- ============================================

CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  departure_date TIMESTAMP WITH TIME ZONE,
  arrival_date TIMESTAMP WITH TIME ZONE,
  carrier TEXT DEFAULT 'AbuSaxiy',
  tracking_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- RLS for shipments
CREATE POLICY "Shipments viewable by authenticated"
ON public.shipments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage shipments"
ON public.shipments FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_manager'::app_role) OR
  public.has_role(auth.uid(), 'uz_manager'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- ============================================
-- 7. SHIPMENT_BOXES TABLE (Many-to-Many)
-- ============================================

CREATE TABLE public.shipment_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shipment_id, box_id)
);

ALTER TABLE public.shipment_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipment boxes viewable by authenticated"
ON public.shipment_boxes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage shipment boxes"
ON public.shipment_boxes FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'xitoy_manager'::app_role) OR
  public.has_role(auth.uid(), 'uz_manager'::app_role)
);

-- ============================================
-- 8. EXCEL_IMPORT_LOGS TABLE
-- ============================================

CREATE TABLE public.excel_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  imported_by UUID REFERENCES auth.users(id),
  rows_processed INTEGER,
  rows_success INTEGER,
  rows_failed INTEGER,
  errors JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.excel_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Excel logs viewable by managers"
ON public.excel_import_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'uz_manager'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Managers can insert excel logs"
ON public.excel_import_logs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'uz_manager'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- ============================================
-- 9. FINANCE_TRANSACTIONS TABLE
-- ============================================

CREATE TABLE public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  category TEXT,
  description TEXT,
  reference_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

-- RLS for finance
CREATE POLICY "Finance viewable by authorized roles"
ON public.finance_transactions FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'moliya_xodimi'::app_role) OR
  public.has_role(auth.uid(), 'investor'::app_role)
);

CREATE POLICY "Finance staff can insert transactions"
ON public.finance_transactions FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role) OR
  public.has_role(auth.uid(), 'moliya_xodimi'::app_role)
);

-- ============================================
-- 10. INVESTOR_REPORTS TABLE
-- ============================================

CREATE TABLE public.investor_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES auth.users(id),
  report_period TEXT NOT NULL,
  investment_amount DECIMAL,
  profit_amount DECIMAL,
  roi_percentage DECIMAL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.investor_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Investors can view own reports"
ON public.investor_reports FOR SELECT
TO authenticated
USING (
  investor_id = auth.uid() OR
  public.has_role(auth.uid(), 'rahbar'::app_role) OR
  public.has_role(auth.uid(), 'bosh_admin'::app_role)
);

-- ============================================
-- 11. TRACKING_EVENTS TABLE
-- ============================================

CREATE TABLE public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  location TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tracking events viewable by authenticated"
ON public.tracking_events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All staff can create tracking events"
ON public.tracking_events FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- 12. AUTO-UPDATE TIMESTAMP FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_boxes_updated_at
BEFORE UPDATE ON public.boxes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- Phase 2 database schema created successfully!
-- All tables, RLS policies, and functions are ready.