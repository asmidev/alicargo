
-- Drop unused worker_commission_pct column from store_profit_distribution
ALTER TABLE public.store_profit_distribution DROP COLUMN IF EXISTS worker_commission_pct;
