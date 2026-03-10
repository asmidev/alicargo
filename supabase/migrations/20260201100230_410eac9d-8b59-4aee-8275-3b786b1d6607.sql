-- Create marketplace_finance_summary table for aggregated finance data
CREATE TABLE public.marketplace_finance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE NOT NULL,
  period_date DATE NOT NULL,
  period_type TEXT DEFAULT 'daily' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  
  -- Revenue
  gross_revenue NUMERIC DEFAULT 0,
  net_revenue NUMERIC DEFAULT 0,
  
  -- Platform fees
  commission_total NUMERIC DEFAULT 0,
  delivery_fees NUMERIC DEFAULT 0,
  storage_fees NUMERIC DEFAULT 0,
  marketing_fees NUMERIC DEFAULT 0,
  return_fees NUMERIC DEFAULT 0,
  other_fees NUMERIC DEFAULT 0,
  
  -- Statistics
  orders_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  cancelled_count INTEGER DEFAULT 0,
  returned_count INTEGER DEFAULT 0,
  items_sold INTEGER DEFAULT 0,
  
  -- Currency & conversion
  currency TEXT DEFAULT 'UZS',
  usd_equivalent NUMERIC,
  exchange_rate_used NUMERIC,
  
  -- Sync metadata
  synced_at TIMESTAMPTZ,
  sync_source TEXT CHECK (sync_source IN ('api', 'calculated', 'manual')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, period_date, period_type)
);

-- Create indexes for fast queries
CREATE INDEX idx_mfs_store_period ON public.marketplace_finance_summary(store_id, period_date);
CREATE INDEX idx_mfs_period_type ON public.marketplace_finance_summary(period_type, period_date);
CREATE INDEX idx_mfs_synced_at ON public.marketplace_finance_summary(synced_at DESC);

-- Add new columns to marketplace_orders for detailed finance tracking
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS profit NUMERIC;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS storage_fee NUMERIC;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS usd_equivalent NUMERIC;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS exchange_rate_at_order NUMERIC;

-- Add marketplace commission columns to finance_transactions for detailed tracking
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS marketplace_commission NUMERIC;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS marketplace_delivery_fee NUMERIC;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS marketplace_store_id UUID REFERENCES public.marketplace_stores(id);

-- Enable RLS on marketplace_finance_summary
ALTER TABLE public.marketplace_finance_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_finance_summary
CREATE POLICY "Finance summary viewable by authorized roles"
ON public.marketplace_finance_summary
FOR SELECT
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'moliya_xodimi'::app_role) OR
  has_role(auth.uid(), 'investor'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Finance summary manageable by admin and finance"
ON public.marketplace_finance_summary
FOR ALL
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'moliya_xodimi'::app_role)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_marketplace_finance_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_marketplace_finance_summary_timestamp
BEFORE UPDATE ON public.marketplace_finance_summary
FOR EACH ROW
EXECUTE FUNCTION update_marketplace_finance_summary_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.marketplace_finance_summary IS 'Aggregated financial summary for marketplace stores (daily/monthly)';