-- Marketplace AI Mega Upgrade: Phase 1 Database Schema

-- Competitor tracking
CREATE TABLE public.marketplace_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_product_url TEXT,
  competitor_sku TEXT,
  competitor_shop_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_competitors ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_competitors
CREATE POLICY "Authenticated users can view competitors" 
ON public.marketplace_competitors FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert competitors" 
ON public.marketplace_competitors FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update competitors" 
ON public.marketplace_competitors FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete competitors" 
ON public.marketplace_competitors FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Competitor price history
CREATE TABLE public.marketplace_competitor_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES public.marketplace_competitors(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  discount_percent NUMERIC,
  rating NUMERIC,
  review_count INTEGER,
  sales_count INTEGER,
  stock_status TEXT,
  captured_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_competitor_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_competitor_prices
CREATE POLICY "Authenticated users can view competitor prices" 
ON public.marketplace_competitor_prices FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert competitor prices" 
ON public.marketplace_competitor_prices FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- AI price suggestions
CREATE TABLE public.marketplace_price_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  current_price NUMERIC,
  recommended_price NUMERIC,
  competitor_avg_price NUMERIC,
  competitor_min_price NUMERIC,
  competitor_max_price NUMERIC,
  expected_sales_change TEXT,
  expected_profit_change TEXT,
  confidence NUMERIC,
  reasoning TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'expired')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- Enable RLS
ALTER TABLE public.marketplace_price_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_price_suggestions
CREATE POLICY "Authenticated users can view price suggestions" 
ON public.marketplace_price_suggestions FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert price suggestions" 
ON public.marketplace_price_suggestions FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update price suggestions" 
ON public.marketplace_price_suggestions FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Daily analytics cache
CREATE TABLE public.marketplace_sales_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  orders_count INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  commission NUMERIC DEFAULT 0,
  units_sold INTEGER DEFAULT 0,
  returns_count INTEGER DEFAULT 0,
  avg_order_value NUMERIC,
  top_product_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);

-- Enable RLS
ALTER TABLE public.marketplace_sales_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_sales_analytics
CREATE POLICY "Authenticated users can view sales analytics" 
ON public.marketplace_sales_analytics FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert sales analytics" 
ON public.marketplace_sales_analytics FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sales analytics" 
ON public.marketplace_sales_analytics FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- AI forecasts
CREATE TABLE public.marketplace_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  forecast_type TEXT NOT NULL CHECK (forecast_type IN ('sales', 'stock', 'revenue', 'demand')),
  forecast_date DATE NOT NULL,
  predicted_value NUMERIC NOT NULL,
  actual_value NUMERIC,
  confidence NUMERIC,
  factors JSONB,
  ai_insights TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_forecasts
CREATE POLICY "Authenticated users can view forecasts" 
ON public.marketplace_forecasts FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert forecasts" 
ON public.marketplace_forecasts FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Add product_rank column to marketplace_listings if not exists
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS product_rank TEXT CHECK (product_rank IN ('A', 'B', 'C', 'D', 'N'));

-- Add cost_price column to marketplace_listings for profit calculation
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC;

-- Add commission_rate column to marketplace_listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_prices_captured_at ON public.marketplace_competitor_prices(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_status ON public.marketplace_price_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_date ON public.marketplace_sales_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON public.marketplace_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_listings_product_rank ON public.marketplace_listings(product_rank);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_marketplace_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_marketplace_competitors_updated_at
  BEFORE UPDATE ON public.marketplace_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_tables_updated_at();

CREATE TRIGGER update_marketplace_sales_analytics_updated_at
  BEFORE UPDATE ON public.marketplace_sales_analytics
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_tables_updated_at();