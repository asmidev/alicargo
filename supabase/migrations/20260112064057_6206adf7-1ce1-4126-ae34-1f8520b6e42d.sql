-- Add unique constraint for marketplace listings upsert
-- This enables ON CONFLICT for product_id, marketplace, store_id combination
ALTER TABLE marketplace_listings 
ADD CONSTRAINT marketplace_listings_product_marketplace_store_unique 
UNIQUE (product_id, marketplace, store_id);