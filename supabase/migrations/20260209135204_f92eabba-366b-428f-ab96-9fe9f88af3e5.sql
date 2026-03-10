-- MUAMMO 1 FIX: Drop old unique index that lacks fulfillment_type
-- This index blocks FBS listings when FBU listing exists for same SKU
DROP INDEX IF EXISTS idx_unique_store_ext_product_sku;

-- Recreate with fulfillment_type included to allow parallel FBS/FBU listings
CREATE UNIQUE INDEX idx_unique_store_ext_product_sku 
ON public.marketplace_listings (store_id, external_product_id, external_sku, fulfillment_type) 
WHERE external_product_id IS NOT NULL;