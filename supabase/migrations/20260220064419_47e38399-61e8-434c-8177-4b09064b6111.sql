
-- Add UNIQUE constraint to marketplace_returns to prevent duplicate inserts
-- Constraint on (platform, store_id, external_order_id, sku_title)
ALTER TABLE public.marketplace_returns
  ADD CONSTRAINT uq_marketplace_returns_key
  UNIQUE (platform, store_id, external_order_id, sku_title);
