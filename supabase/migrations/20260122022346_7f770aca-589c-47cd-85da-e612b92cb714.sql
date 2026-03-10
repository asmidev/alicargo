-- =====================================================
-- PHASE 1: MARKETPLACE DATABASE INFRASTRUCTURE
-- 8 jadval + 6 do'kon seed data
-- =====================================================

-- 1. MARKETPLACE_STORES - Do'konlar ro'yxati (6 ta do'kon uchun)
CREATE TABLE public.marketplace_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('yandex', 'uzum')),
  is_active BOOLEAN DEFAULT true,
  
  -- Yandex uchun
  yandex_campaign_id TEXT,
  yandex_business_ids TEXT[],
  yandex_warehouse_id TEXT,
  yandex_api_key_secret TEXT,
  
  -- Uzum uchun
  uzum_shop_ids INTEGER[],
  uzum_seller_id INTEGER,
  uzum_api_key_secret TEXT,
  
  -- Statistika
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'partial', 'pending')),
  products_count INTEGER DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MARKETPLACE_LISTINGS - Mahsulot-Do'kon bog'lanishi
CREATE TABLE public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  
  -- Marketplace identifikatorlari
  external_sku TEXT,
  external_product_id TEXT,
  external_offer_id TEXT,
  
  -- Narx va stok
  price DECIMAL(12,2),
  compare_at_price DECIMAL(12,2),
  stock_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  
  -- Holat
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'rejected', 'archived')),
  moderation_status TEXT,
  rejection_reason TEXT,
  
  -- Sync
  last_price_sync TIMESTAMPTZ,
  last_stock_sync TIMESTAMPTZ,
  sync_errors JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, product_id, variant_id)
);

-- 3. MARKETPLACE_ORDERS - Marketplace buyurtmalari
CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  -- Tashqi identifikatorlar
  external_order_id TEXT NOT NULL,
  external_order_number TEXT,
  
  -- Mijoz
  customer_name TEXT,
  customer_phone TEXT,
  customer_address JSONB,
  
  -- Buyurtma tafsilotlari
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(12,2),
  shipping_cost DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  currency TEXT DEFAULT 'UZS',
  
  -- Holatlar
  order_status TEXT,
  payment_status TEXT,
  fulfillment_status TEXT,
  
  -- Vaqtlar
  order_created_at TIMESTAMPTZ,
  order_updated_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Internal tracking
  internal_order_id UUID,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, external_order_id)
);

-- 4. MARKETPLACE_SYNC_LOGS - Sinxronizatsiya loglari
CREATE TABLE public.marketplace_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  sync_type TEXT NOT NULL CHECK (sync_type IN ('products', 'stocks', 'prices', 'orders', 'reviews', 'questions', 'full')),
  direction TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'both')),
  
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  items_processed INTEGER DEFAULT 0,
  items_succeeded INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  
  error_message TEXT,
  error_details JSONB,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  triggered_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. MARKETPLACE_REVIEWS - Sharhlar
CREATE TABLE public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  
  external_review_id TEXT,
  external_order_id TEXT,
  external_product_id TEXT,
  
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  pros TEXT,
  cons TEXT,
  
  customer_name TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  
  -- Javob
  our_response TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID,
  
  -- AI tahlil
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  ai_suggested_response TEXT,
  key_topics TEXT[],
  
  -- Metadata
  photos JSONB,
  review_created_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, external_review_id)
);

-- 6. MARKETPLACE_QUESTIONS - Savollar
CREATE TABLE public.marketplace_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  
  external_question_id TEXT,
  external_product_id TEXT,
  question_text TEXT NOT NULL,
  customer_name TEXT,
  
  answer_text TEXT,
  answered_at TIMESTAMPTZ,
  answered_by UUID,
  
  ai_suggested_answer TEXT,
  is_published BOOLEAN DEFAULT false,
  
  question_created_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, external_question_id)
);

-- 7. MARKETPLACE_COMPETITORS - Raqobatchilar
CREATE TABLE public.marketplace_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('yandex', 'uzum', 'other')),
  store_url TEXT,
  store_id TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. MARKETPLACE_COMPETITOR_PRICES - Raqobat narxlari
CREATE TABLE public.marketplace_competitor_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.marketplace_competitors(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  
  competitor_price DECIMAL(12,2) NOT NULL,
  competitor_sku TEXT,
  competitor_url TEXT,
  competitor_product_name TEXT,
  
  our_price DECIMAL(12,2),
  price_difference DECIMAL(12,2),
  price_difference_percent DECIMAL(5,2),
  
  fetched_at TIMESTAMPTZ DEFAULT now(),
  is_in_stock BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX idx_marketplace_stores_platform ON public.marketplace_stores(platform);
CREATE INDEX idx_marketplace_stores_active ON public.marketplace_stores(is_active);

CREATE INDEX idx_marketplace_listings_store ON public.marketplace_listings(store_id);
CREATE INDEX idx_marketplace_listings_product ON public.marketplace_listings(product_id);
CREATE INDEX idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_external_sku ON public.marketplace_listings(external_sku);

CREATE INDEX idx_marketplace_orders_store ON public.marketplace_orders(store_id);
CREATE INDEX idx_marketplace_orders_status ON public.marketplace_orders(order_status);
CREATE INDEX idx_marketplace_orders_created ON public.marketplace_orders(order_created_at DESC);
CREATE INDEX idx_marketplace_orders_external ON public.marketplace_orders(external_order_id);

CREATE INDEX idx_marketplace_sync_logs_store ON public.marketplace_sync_logs(store_id);
CREATE INDEX idx_marketplace_sync_logs_type ON public.marketplace_sync_logs(sync_type);
CREATE INDEX idx_marketplace_sync_logs_started ON public.marketplace_sync_logs(started_at DESC);

CREATE INDEX idx_marketplace_reviews_store ON public.marketplace_reviews(store_id);
CREATE INDEX idx_marketplace_reviews_listing ON public.marketplace_reviews(listing_id);
CREATE INDEX idx_marketplace_reviews_rating ON public.marketplace_reviews(rating);
CREATE INDEX idx_marketplace_reviews_sentiment ON public.marketplace_reviews(sentiment);
CREATE INDEX idx_marketplace_reviews_responded ON public.marketplace_reviews(responded_at) WHERE responded_at IS NULL;

CREATE INDEX idx_marketplace_questions_store ON public.marketplace_questions(store_id);
CREATE INDEX idx_marketplace_questions_unanswered ON public.marketplace_questions(answered_at) WHERE answered_at IS NULL;

CREATE INDEX idx_marketplace_competitor_prices_competitor ON public.marketplace_competitor_prices(competitor_id);
CREATE INDEX idx_marketplace_competitor_prices_product ON public.marketplace_competitor_prices(product_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_competitor_prices ENABLE ROW LEVEL SECURITY;

-- Stores: Authenticated users can view, admins can modify (using correct role names)
CREATE POLICY "Authenticated users can view stores" ON public.marketplace_stores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage stores" ON public.marketplace_stores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'))
  WITH CHECK (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'));

-- Listings: All authenticated can view, admins can modify
CREATE POLICY "Authenticated users can view listings" ON public.marketplace_listings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage listings" ON public.marketplace_listings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'manager'));

-- Orders: All authenticated can view, admins can modify
CREATE POLICY "Authenticated users can view orders" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage orders" ON public.marketplace_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'uz_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'uz_manager'));

-- Sync Logs: All authenticated can view
CREATE POLICY "Authenticated users can view sync logs" ON public.marketplace_sync_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert sync logs" ON public.marketplace_sync_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Reviews: All authenticated can view and respond
CREATE POLICY "Authenticated users can view reviews" ON public.marketplace_reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can respond to reviews" ON public.marketplace_reviews
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can insert reviews" ON public.marketplace_reviews
  FOR INSERT TO authenticated WITH CHECK (true);

-- Questions: All authenticated can view and answer
CREATE POLICY "Authenticated users can view questions" ON public.marketplace_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can answer questions" ON public.marketplace_questions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can insert questions" ON public.marketplace_questions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Competitors: All authenticated can view, admins can modify
CREATE POLICY "Authenticated users can view competitors" ON public.marketplace_competitors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage competitors" ON public.marketplace_competitors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'))
  WITH CHECK (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'));

-- Competitor Prices: All authenticated can view, admins can modify
CREATE POLICY "Authenticated users can view competitor prices" ON public.marketplace_competitor_prices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage competitor prices" ON public.marketplace_competitor_prices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'))
  WITH CHECK (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'));

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================

CREATE TRIGGER update_marketplace_stores_updated_at
  BEFORE UPDATE ON public.marketplace_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_reviews_updated_at
  BEFORE UPDATE ON public.marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_questions_updated_at
  BEFORE UPDATE ON public.marketplace_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_competitors_updated_at
  BEFORE UPDATE ON public.marketplace_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SEED DATA: 6 DO'KON (3 Yandex, 3 Uzum)
-- =====================================================

-- Yandex do'konlari
INSERT INTO public.marketplace_stores (name, platform, yandex_campaign_id, yandex_business_ids, yandex_api_key_secret) VALUES
('Yandex Atlas', 'yandex', '216575313', ARRAY['216575312'], 'YANDEX_ATLAS_API_KEY'),
('Yandex 2-Market', 'yandex', '216515645', ARRAY['216587329'], 'YANDEX_2_API_KEY'),
('Yandex 3-Market', 'yandex', '148843590', ARRAY['216469175', '216561639'], 'YANDEX_3_API_KEY');

-- Uzum do'konlari
INSERT INTO public.marketplace_stores (name, platform, uzum_shop_ids, uzum_seller_id, uzum_api_key_secret) VALUES
('Uzum Atlas', 'uzum', ARRAY[92638, 89165], 356944, 'UZUM_ATLAS_API_KEY'),
('Uzum 2-Market', 'uzum', ARRAY[69508, 69555, 70010, 88409], 316698, 'UZUM_2_API_KEY'),
('Uzum 3-Market', 'uzum', ARRAY[49052, 66005, 92815], 316698, 'UZUM_3_API_KEY');

-- =====================================================
-- ENABLE REALTIME for orders and sync logs
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_sync_logs;