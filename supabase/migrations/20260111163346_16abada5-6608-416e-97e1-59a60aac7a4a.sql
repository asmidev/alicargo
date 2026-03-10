-- Phase 7.1: Marketplace Infrastructure (Fixed)

-- 1. Create marketplace_stores table for 6 stores (3 Yandex + 3 Uzum)
CREATE TABLE public.marketplace_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  marketplace public.marketplace_type NOT NULL,
  store_ids TEXT[],
  campaign_id TEXT,
  api_key_secret_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sync_settings JSONB DEFAULT '{
    "auto_sync_enabled": true,
    "sync_interval_minutes": 30,
    "sync_stock": true,
    "sync_prices": true,
    "sync_orders": true
  }'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create marketplace_orders table
CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  external_order_id TEXT NOT NULL,
  marketplace public.marketplace_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address JSONB,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount DECIMAL(12,2),
  currency TEXT DEFAULT 'UZS',
  marketplace_commission DECIMAL(12,2),
  net_amount DECIMAL(12,2),
  order_created_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(marketplace, external_order_id)
);

-- 3. Create marketplace_sync_logs table
CREATE TABLE public.marketplace_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_processed INT DEFAULT 0,
  items_failed INT DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 4. Create marketplace_price_rules table
CREATE TABLE public.marketplace_price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories_hierarchy(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL DEFAULT 'percentage',
  markup_value DECIMAL(8,2) NOT NULL DEFAULT 0,
  min_price DECIMAL(12,2),
  max_price DECIMAL(12,2),
  rounding_to INT DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Update marketplace_listings table with new columns
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS marketplace_price DECIMAL(12,2);

ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS marketplace_stock INT DEFAULT 0;

ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);

ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'UZS';

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_stores_marketplace ON public.marketplace_stores(marketplace);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_store_id ON public.marketplace_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON public.marketplace_orders(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created ON public.marketplace_orders(order_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_sync_logs_store ON public.marketplace_sync_logs(store_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_store ON public.marketplace_listings(store_id);

-- 7. Enable RLS on new tables
ALTER TABLE public.marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_price_rules ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for marketplace_stores (rahbar/bosh_admin for write, all authenticated for read)
CREATE POLICY "Authenticated users can view marketplace stores"
ON public.marketplace_stores FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert marketplace stores"
ON public.marketplace_stores FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar')
);

CREATE POLICY "Admins can update marketplace stores"
ON public.marketplace_stores FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar')
);

CREATE POLICY "Admins can delete marketplace stores"
ON public.marketplace_stores FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar')
);

-- 9. RLS Policies for marketplace_orders
CREATE POLICY "Authenticated users can view marketplace orders"
ON public.marketplace_orders FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert marketplace orders"
ON public.marketplace_orders FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar') OR
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins can update marketplace orders"
ON public.marketplace_orders FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar') OR
  public.has_role(auth.uid(), 'manager')
);

-- 10. RLS Policies for marketplace_sync_logs
CREATE POLICY "Authenticated users can view sync logs"
ON public.marketplace_sync_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can insert sync logs"
ON public.marketplace_sync_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 11. RLS Policies for marketplace_price_rules
CREATE POLICY "Authenticated users can view price rules"
ON public.marketplace_price_rules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert price rules"
ON public.marketplace_price_rules FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar')
);

CREATE POLICY "Admins can update price rules"
ON public.marketplace_price_rules FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar')
);

CREATE POLICY "Admins can delete price rules"
ON public.marketplace_price_rules FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'bosh_admin') OR 
  public.has_role(auth.uid(), 'rahbar')
);

-- 12. Triggers for updated_at
CREATE TRIGGER update_marketplace_stores_updated_at
BEFORE UPDATE ON public.marketplace_stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_orders_updated_at
BEFORE UPDATE ON public.marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_price_rules_updated_at
BEFORE UPDATE ON public.marketplace_price_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders;