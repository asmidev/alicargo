
-- Create FBU activity log table for tracking supply, returns, stock snapshots, and estimated sales
CREATE TABLE public.fbu_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,  -- 'supply', 'return', 'stock_snapshot', 'estimated_sale'
  external_id TEXT,             -- invoice ID or return ID
  product_id TEXT,
  product_title TEXT,
  sku_title TEXT,
  quantity INTEGER DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  status TEXT,
  activity_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, activity_type, external_id)
);

-- Add indexes for efficient querying
CREATE INDEX idx_fbu_activity_store_type_date ON public.fbu_activity_log(store_id, activity_type, activity_date);
CREATE INDEX idx_fbu_activity_product ON public.fbu_activity_log(product_id);

-- Enable RLS
ALTER TABLE public.fbu_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can read all (team-wide data)
CREATE POLICY "Authenticated users can read fbu_activity_log"
  ON public.fbu_activity_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert/update (edge functions)
CREATE POLICY "Service role can manage fbu_activity_log"
  ON public.fbu_activity_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
