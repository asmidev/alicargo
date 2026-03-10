-- =============================================
-- NEW MARKETPLACE INTEGRATION SCHEMA
-- Supports 7 Uzum stores + 3 Yandex stores
-- Special handling for Yandex FBY/FBS dual fulfillment
-- =============================================

-- 1. Marketplace Stores Configuration
CREATE TABLE public.marketplace_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('uzum', 'yandex')),
  
  -- Uzum-specific fields
  shop_id TEXT,
  seller_id TEXT,
  
  -- Yandex-specific fields
  business_id TEXT,
  campaign_id TEXT,
  fby_campaign_id TEXT,
  fbs_campaign_id TEXT,
  fulfillment_type TEXT CHECK (fulfillment_type IN ('standard', 'fby', 'fbs', 'fby_fbs')),
  
  -- API credentials (stored as secret reference name)
  api_key_secret_name TEXT NOT NULL,
  
  -- Status and sync tracking
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  sync_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Marketplace Listings
CREATE TABLE public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  external_sku TEXT NOT NULL,
  external_product_id TEXT,
  external_offer_id TEXT,
  fulfillment_type TEXT CHECK (fulfillment_type IN ('fby', 'fbs', NULL)),
  
  title TEXT,
  price NUMERIC,
  compare_price NUMERIC,
  currency TEXT DEFAULT 'UZS',
  stock INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'pending', 'error')),
  moderation_status TEXT,
  
  last_synced_at TIMESTAMPTZ,
  external_updated_at TIMESTAMPTZ,
  sync_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, external_sku, fulfillment_type)
);

-- 3. Marketplace Orders
CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  external_order_id TEXT NOT NULL,
  order_number TEXT,
  fulfillment_type TEXT CHECK (fulfillment_type IN ('fby', 'fbs', NULL)),
  
  status TEXT NOT NULL,
  substatus TEXT,
  payment_status TEXT,
  fulfillment_status TEXT DEFAULT 'pending',
  
  total_amount NUMERIC,
  items_total NUMERIC,
  delivery_cost NUMERIC,
  commission NUMERIC,
  currency TEXT DEFAULT 'UZS',
  
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  shipping_address JSONB,
  delivery_type TEXT,
  
  items JSONB NOT NULL DEFAULT '[]',
  
  ordered_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  notes TEXT,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, external_order_id)
);

-- 4. Sync Logs
CREATE TABLE public.marketplace_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  sync_type TEXT NOT NULL CHECK (sync_type IN ('orders', 'listings', 'stock', 'prices', 'full')),
  fulfillment_type TEXT,
  
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error', 'partial')),
  
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  error_message TEXT,
  error_details JSONB,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE public.marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_sync_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (using existing roles only)
CREATE POLICY "Allow read access to marketplace_stores" ON public.marketplace_stores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow full access to marketplace_stores for managers" ON public.marketplace_stores
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('rahbar', 'bosh_admin', 'manager')
    )
  );

CREATE POLICY "Allow read access to marketplace_listings" ON public.marketplace_listings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow full access to marketplace_listings for managers" ON public.marketplace_listings
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('rahbar', 'bosh_admin', 'manager')
    )
  );

CREATE POLICY "Allow read access to marketplace_orders" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow full access to marketplace_orders for managers" ON public.marketplace_orders
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('rahbar', 'bosh_admin', 'manager')
    )
  );

CREATE POLICY "Allow read access to marketplace_sync_logs" ON public.marketplace_sync_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert to marketplace_sync_logs" ON public.marketplace_sync_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Indexes
CREATE INDEX idx_marketplace_stores_platform ON public.marketplace_stores(platform);
CREATE INDEX idx_marketplace_stores_active ON public.marketplace_stores(is_active);
CREATE INDEX idx_marketplace_listings_store ON public.marketplace_listings(store_id);
CREATE INDEX idx_marketplace_listings_product ON public.marketplace_listings(product_id);
CREATE INDEX idx_marketplace_listings_sku ON public.marketplace_listings(external_sku);
CREATE INDEX idx_marketplace_orders_store ON public.marketplace_orders(store_id);
CREATE INDEX idx_marketplace_orders_external ON public.marketplace_orders(external_order_id);
CREATE INDEX idx_marketplace_orders_status ON public.marketplace_orders(status);
CREATE INDEX idx_marketplace_orders_ordered_at ON public.marketplace_orders(ordered_at DESC);
CREATE INDEX idx_marketplace_sync_logs_store ON public.marketplace_sync_logs(store_id);

-- 8. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_marketplace_stores_updated_at
  BEFORE UPDATE ON public.marketplace_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

CREATE TRIGGER update_marketplace_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

-- 9. Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders;