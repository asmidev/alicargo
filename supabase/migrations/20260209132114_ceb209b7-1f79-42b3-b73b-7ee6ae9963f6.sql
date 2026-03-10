
-- MUAMMO 1: Drop the restrictive unique index and create a better one
DROP INDEX IF EXISTS idx_unique_store_ext_product;

-- New index that allows multiple SKUs per product
CREATE UNIQUE INDEX idx_unique_store_ext_product_sku 
ON marketplace_listings (store_id, external_product_id, external_sku) 
WHERE external_product_id IS NOT NULL;
