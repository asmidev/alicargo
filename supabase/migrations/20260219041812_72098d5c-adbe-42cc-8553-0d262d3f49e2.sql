-- Add stock_fby column to marketplace_listings for Yandex FBY warehouse stock
-- This separates Yandex FBY stock (fulfilled by Yandex warehouse) from 
-- Uzum FBU stock (fulfilled by Uzum warehouse) which were previously conflated in stock_fbu
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS stock_fby integer DEFAULT NULL;

-- Add comment explaining the column semantics
COMMENT ON COLUMN public.marketplace_listings.stock_fby IS 'Yandex FBY (Fulfilled By Yandex) warehouse stock. Separate from stock_fbu (Uzum FBU) to prevent cross-platform stock conflation in analytics.';
COMMENT ON COLUMN public.marketplace_listings.stock_fbu IS 'Uzum FBU (Fulfilled By Uzum) warehouse stock. For Yandex FBY stock, use stock_fby column.';

-- Index for analytics queries filtering by FBY stock
CREATE INDEX IF NOT EXISTS idx_ml_stock_fby ON public.marketplace_listings(stock_fby) WHERE stock_fby IS NOT NULL AND stock_fby > 0;