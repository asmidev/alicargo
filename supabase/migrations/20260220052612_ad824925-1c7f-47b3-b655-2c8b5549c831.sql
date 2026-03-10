-- Add return_type column to marketplace_returns
ALTER TABLE public.marketplace_returns 
ADD COLUMN IF NOT EXISTS return_type text DEFAULT 'fbs_order';

-- Add store_name and nakladnoy_id columns for Uzum return invoice data
ALTER TABLE public.marketplace_returns
ADD COLUMN IF NOT EXISTS nakladnoy_id text,
ADD COLUMN IF NOT EXISTS store_name text;

-- Mark all existing records as fbs_order (synced from marketplace_orders)
UPDATE public.marketplace_returns
SET return_type = 'fbs_order'
WHERE return_type IS NULL OR return_type = 'fbs_order';

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_marketplace_returns_return_type ON public.marketplace_returns(return_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_returns_nakladnoy_id ON public.marketplace_returns(nakladnoy_id);