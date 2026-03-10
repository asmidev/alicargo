-- Phase 8.5: AI Dynamic Pricing Engine Tables

-- Price history tracking for A/B testing and analytics
CREATE TABLE public.ai_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE SET NULL,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  price_change_percent NUMERIC,
  change_reason TEXT,
  change_source TEXT DEFAULT 'manual', -- manual, ai_recommendation, price_rule, competitor_match
  recommendation_id UUID REFERENCES public.ai_price_recommendations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- A/B price testing experiments
CREATE TABLE public.ai_price_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE SET NULL,
  experiment_name TEXT NOT NULL,
  control_price NUMERIC NOT NULL,
  test_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, active, paused, completed
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  control_views INTEGER DEFAULT 0,
  control_orders INTEGER DEFAULT 0,
  control_revenue NUMERIC DEFAULT 0,
  test_views INTEGER DEFAULT 0,
  test_orders INTEGER DEFAULT 0,
  test_revenue NUMERIC DEFAULT 0,
  winner TEXT, -- control, test, inconclusive
  confidence_level NUMERIC,
  ai_recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Competitor price monitoring schedules
CREATE TABLE public.ai_competitor_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_url TEXT,
  marketplace TEXT NOT NULL,
  monitor_frequency TEXT DEFAULT 'daily', -- hourly, daily, weekly
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_price NUMERIC,
  price_alert_threshold NUMERIC DEFAULT 10, -- Alert if price differs by this %
  auto_match_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price alerts for significant changes
CREATE TABLE public.ai_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- competitor_undercut, margin_warning, opportunity, experiment_winner
  severity TEXT DEFAULT 'medium', -- low, medium, high, critical
  title TEXT NOT NULL,
  description TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  action_taken TEXT,
  action_taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_price_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_competitor_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_price_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow authenticated users)
CREATE POLICY "Authenticated users can view price history" ON public.ai_price_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert price history" ON public.ai_price_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view experiments" ON public.ai_price_experiments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage experiments" ON public.ai_price_experiments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view competitor monitors" ON public.ai_competitor_monitors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage competitor monitors" ON public.ai_competitor_monitors
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view price alerts" ON public.ai_price_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage price alerts" ON public.ai_price_alerts
  FOR ALL USING (auth.role() = 'authenticated');

-- Index for faster queries
CREATE INDEX idx_price_history_product ON public.ai_price_history(product_id, created_at DESC);
CREATE INDEX idx_price_experiments_status ON public.ai_price_experiments(status);
CREATE INDEX idx_price_alerts_unread ON public.ai_price_alerts(is_read, is_dismissed, created_at DESC);
CREATE INDEX idx_competitor_monitors_active ON public.ai_competitor_monitors(is_active, last_checked_at);

-- Trigger to update updated_at
CREATE TRIGGER update_price_experiments_updated_at
  BEFORE UPDATE ON public.ai_price_experiments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();