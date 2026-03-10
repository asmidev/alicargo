
-- Cache table for FBU order real dates (captured proactively before TTL expires)
CREATE TABLE public.fbu_order_date_cache (
  order_id TEXT PRIMARY KEY,
  store_id UUID REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  date_created TIMESTAMPTZ,
  accepted_date TIMESTAMPTZ,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup by store
CREATE INDEX idx_fbu_cache_store ON public.fbu_order_date_cache(store_id);

-- RLS: service role only (edge functions use service role key)
ALTER TABLE public.fbu_order_date_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (no anon access needed)
CREATE POLICY "Service role full access" ON public.fbu_order_date_cache
  FOR ALL USING (true) WITH CHECK (true);
