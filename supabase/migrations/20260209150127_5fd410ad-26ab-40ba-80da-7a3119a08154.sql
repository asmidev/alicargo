-- Add unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_mfs_store_period_type
ON public.marketplace_finance_summary(store_id, period_date, period_type);