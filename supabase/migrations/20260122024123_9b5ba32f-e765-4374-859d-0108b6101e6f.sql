-- Create top_sellers table for tracking best-selling competitors
CREATE TABLE public.top_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('yandex', 'uzum')),
  category_id TEXT,
  category_name TEXT,
  product_name TEXT NOT NULL,
  seller_name TEXT,
  seller_id TEXT,
  
  -- Sales metrics
  sales_count INTEGER,
  rating DECIMAL(2,1),
  reviews_count INTEGER,
  orders_count INTEGER,
  popularity_rank INTEGER,
  
  -- Price info
  price DECIMAL(12,2),
  compare_at_price DECIMAL(12,2),
  currency TEXT DEFAULT 'UZS',
  
  -- Matching to our products
  our_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  our_listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  match_confidence DECIMAL(3,2) DEFAULT 0,
  match_method TEXT,
  
  -- Metadata
  external_url TEXT,
  external_sku TEXT,
  external_product_id TEXT,
  thumbnail_url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_top_sellers_platform ON public.top_sellers(platform);
CREATE INDEX idx_top_sellers_our_product ON public.top_sellers(our_product_id);
CREATE INDEX idx_top_sellers_popularity ON public.top_sellers(popularity_rank);
CREATE INDEX idx_top_sellers_fetched ON public.top_sellers(fetched_at DESC);

-- Add new columns to marketplace_competitor_prices
ALTER TABLE public.marketplace_competitor_prices 
ADD COLUMN IF NOT EXISTS is_top_seller BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sales_rank INTEGER,
ADD COLUMN IF NOT EXISTS reviews_count INTEGER,
ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(2,1),
ADD COLUMN IF NOT EXISTS orders_count INTEGER;

-- Create price_gap_alerts table for tracking when we fall behind
CREATE TABLE public.price_gap_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  top_seller_id UUID REFERENCES public.top_sellers(id) ON DELETE CASCADE,
  
  our_price DECIMAL(12,2) NOT NULL,
  competitor_price DECIMAL(12,2) NOT NULL,
  price_gap_percent DECIMAL(5,2) NOT NULL,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN ('falling_behind', 'significantly_cheaper', 'new_competitor')),
  alert_level TEXT NOT NULL CHECK (alert_level IN ('info', 'warning', 'critical')),
  
  suggested_price DECIMAL(12,2),
  reasoning TEXT,
  
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  telegram_sent BOOLEAN DEFAULT false,
  telegram_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_gap_alerts_unread ON public.price_gap_alerts(is_read, is_resolved) WHERE is_read = false AND is_resolved = false;
CREATE INDEX idx_price_gap_alerts_product ON public.price_gap_alerts(product_id);

-- Enable RLS
ALTER TABLE public.top_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_gap_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for top_sellers
CREATE POLICY "Authenticated users can view top sellers"
ON public.top_sellers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage top sellers"
ON public.top_sellers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('rahbar', 'bosh_admin', 'manager', 'uz_manager')
  )
);

-- RLS policies for price_gap_alerts
CREATE POLICY "Authenticated users can view price gap alerts"
ON public.price_gap_alerts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage price gap alerts"
ON public.price_gap_alerts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('rahbar', 'bosh_admin', 'manager', 'uz_manager')
  )
);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_gap_alerts;

-- Trigger for updated_at
CREATE TRIGGER update_top_sellers_updated_at
  BEFORE UPDATE ON public.top_sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();