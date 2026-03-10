-- Phase 6: Financial Module + AI Analytics

-- Financial forecasts table for AI predictions
CREATE TABLE public.financial_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  predicted_amount NUMERIC NOT NULL,
  confidence NUMERIC DEFAULT 0.5,
  currency TEXT DEFAULT 'USD',
  ai_model TEXT DEFAULT 'gemini-2.5-flash',
  ai_insights TEXT,
  factors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- AI analysis cache to avoid repeated API calls
CREATE TABLE public.ai_analysis_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_type TEXT NOT NULL,
  cache_key TEXT NOT NULL UNIQUE,
  result JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Extend investor_reports with more fields
ALTER TABLE public.investor_reports 
ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS period_start DATE,
ADD COLUMN IF NOT EXISTS period_end DATE,
ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_profit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS inventory_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_flow JSONB,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Financial periods for P&L and Cash Flow statements
CREATE TABLE public.financial_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  revenue NUMERIC DEFAULT 0,
  cost_of_goods_sold NUMERIC DEFAULT 0,
  gross_profit NUMERIC DEFAULT 0,
  operating_expenses NUMERIC DEFAULT 0,
  net_profit NUMERIC DEFAULT 0,
  cash_inflow NUMERIC DEFAULT 0,
  cash_outflow NUMERIC DEFAULT 0,
  net_cash_flow NUMERIC DEFAULT 0,
  inventory_start_value NUMERIC DEFAULT 0,
  inventory_end_value NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(period_type, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.financial_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_forecasts (using correct enum values)
CREATE POLICY "Admin and finance can view forecasts"
ON public.financial_forecasts FOR SELECT
USING (
  public.has_role(auth.uid(), 'rahbar') OR 
  public.has_role(auth.uid(), 'bosh_admin') OR
  public.has_role(auth.uid(), 'moliya_xodimi')
);

CREATE POLICY "Admin and finance can create forecasts"
ON public.financial_forecasts FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar') OR 
  public.has_role(auth.uid(), 'bosh_admin') OR
  public.has_role(auth.uid(), 'moliya_xodimi')
);

-- RLS Policies for ai_analysis_cache
CREATE POLICY "Authenticated users can read cache"
ON public.ai_analysis_cache FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage cache"
ON public.ai_analysis_cache FOR ALL
USING (true);

-- RLS Policies for financial_periods
CREATE POLICY "Admin finance investor can view periods"
ON public.financial_periods FOR SELECT
USING (
  public.has_role(auth.uid(), 'rahbar') OR 
  public.has_role(auth.uid(), 'bosh_admin') OR
  public.has_role(auth.uid(), 'moliya_xodimi') OR
  public.has_role(auth.uid(), 'investor')
);

CREATE POLICY "Admin and finance can manage periods"
ON public.financial_periods FOR ALL
USING (
  public.has_role(auth.uid(), 'rahbar') OR 
  public.has_role(auth.uid(), 'bosh_admin') OR
  public.has_role(auth.uid(), 'moliya_xodimi')
);

-- Update investor_reports RLS
DROP POLICY IF EXISTS "Investors can view their own reports" ON public.investor_reports;
CREATE POLICY "Investors can view their own reports"
ON public.investor_reports FOR SELECT
USING (
  investor_id = auth.uid() OR
  public.has_role(auth.uid(), 'rahbar') OR 
  public.has_role(auth.uid(), 'bosh_admin') OR
  public.has_role(auth.uid(), 'moliya_xodimi')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_forecasts_type ON public.financial_forecasts(forecast_type);
CREATE INDEX IF NOT EXISTS idx_financial_periods_dates ON public.financial_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON public.ai_analysis_cache(expires_at);