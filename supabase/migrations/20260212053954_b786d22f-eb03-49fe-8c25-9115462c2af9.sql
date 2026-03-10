
-- 1. Store delivery/payment/status enums
CREATE TYPE public.store_delivery_type AS ENUM ('delivery', 'pickup');
CREATE TYPE public.store_payment_type AS ENUM ('cash', 'card', 'transfer');
CREATE TYPE public.store_order_status AS ENUM ('new', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled');

-- 2. Store categories table
CREATE TABLE public.store_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_uz TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  parent_id UUID REFERENCES public.store_categories(id),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active store categories"
  ON public.store_categories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage store categories"
  ON public.store_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Store orders table
CREATE TABLE public.store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  delivery_type public.store_delivery_type DEFAULT 'delivery',
  payment_type public.store_payment_type DEFAULT 'cash',
  status public.store_order_status DEFAULT 'new',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  notes TEXT,
  confirmed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT orders (customers placing orders)
CREATE POLICY "Anyone can place store orders"
  ON public.store_orders FOR INSERT
  WITH CHECK (true);

-- Authenticated staff can view and manage orders
CREATE POLICY "Staff can view all store orders"
  ON public.store_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can update store orders"
  ON public.store_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Order number generator
CREATE OR REPLACE FUNCTION public.generate_store_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_prefix TEXT;
  seq_num INTEGER;
BEGIN
  today_prefix := 'AB-' || to_char(now(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(order_number, '^AB-\d{8}-', ''), '')::INTEGER
  ), 0) + 1
  INTO seq_num
  FROM public.store_orders
  WHERE order_number LIKE today_prefix || '-%';
  
  NEW.order_number := today_prefix || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_store_order_number
  BEFORE INSERT ON public.store_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION public.generate_store_order_number();

-- Updated_at trigger
CREATE TRIGGER update_store_orders_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Add store columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_visible BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_category_id UUID REFERENCES public.store_categories(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_description TEXT;

-- 6. Anon read policy for products (storefront needs to read products)
CREATE POLICY "Anyone can view store-visible products"
  ON public.products FOR SELECT
  USING (true);

-- 7. Enable realtime for store_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_orders;
